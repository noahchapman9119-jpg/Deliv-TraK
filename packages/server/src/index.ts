import type * as winston from "winston";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { typeDefs, resolvers, type AppContext } from "@delivery-tracker/api";
import {
  DefaultCarrierRegistry,
  logger as coreLogger,
} from "@delivery-tracker/core";
import {
  ApolloServerErrorCode,
  unwrapResolverError,
} from "@apollo/server/errors";
import { initLogger } from "./logger";
import { createProxy, lookupProxy } from "./proxy-store";
import { renderTrackingPage, renderErrorPage, renderNotFoundPage } from "./tracking-page";

const serverRootLogger: winston.Logger = coreLogger.rootLogger.child({
  module: "server",
});

const apolloServer = new ApolloServer<{ appContext: AppContext }>({
  typeDefs,
  resolvers: resolvers.resolvers,
  formatError: (formattedError, error) => {
    const extensions = formattedError.extensions ?? {};
    switch (extensions.code) {
      case "INTERNAL":
      case "BAD_REQUEST":
      case "NOT_FOUND":
      case ApolloServerErrorCode.INTERNAL_SERVER_ERROR:
        extensions.code = "INTERNAL";
        break;
      case ApolloServerErrorCode.GRAPHQL_PARSE_FAILED:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.PERSISTED_QUERY_NOT_FOUND:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.PERSISTED_QUERY_NOT_SUPPORTED:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.BAD_USER_INPUT:
        extensions.code = "BAD_REQUEST";
        break;
      case ApolloServerErrorCode.OPERATION_RESOLUTION_FAILURE:
        extensions.code = "BAD_REQUEST";
        break;
      default:
        extensions.code = "INTERNAL";
        break;
    }

    if (extensions.code === "INTERNAL") {
      serverRootLogger.error("internal error response", {
        formattedError,
        error: unwrapResolverError(error),
      });
    }

    return {
      ...formattedError,
      extensions,
      message:
        extensions.code === "INTERNAL"
          ? "Internal error"
          : formattedError.message,
    };
  },
});

async function main(): Promise<void> {
  const carrierRegistry = new DefaultCarrierRegistry();
  await carrierRegistry.init();

  const appContext: AppContext = { carrierRegistry };

  await apolloServer.start();

  const app = express();
  const PORT = 4000;

  app.use(cors<cors.CorsRequest>());
  app.use(express.json());

  // GraphQL endpoint (same path as before)
  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: async () => ({ appContext }),
    })
  );

  // Create a proxy tracking link
  // POST /api/proxy  { carrierId: "us.fedex", trackingNumber: "123456789" }
  // Returns: { proxyId: "TRK-ABCD-EFGH", shareUrl: "http://..." }
  app.post("/api/proxy", (req, res) => {
    const { carrierId, trackingNumber } = req.body as { carrierId?: string; trackingNumber?: string };

    if (!carrierId || !trackingNumber) {
      res.status(400).json({ error: "carrierId and trackingNumber are required" });
      return;
    }

    const carrier = carrierRegistry.get(carrierId);
    if (carrier == null) {
      res.status(400).json({ error: `Unknown carrier: ${carrierId}` });
      return;
    }

    const proxyId = createProxy(carrierId, trackingNumber);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const shareUrl = `${baseUrl}/track/${proxyId}`;

    serverRootLogger.info("proxy created", { proxyId, carrierId });
    res.json({ proxyId, shareUrl });
  });

  // Show tracking page for a proxy link
  // GET /track/:proxyId
  app.get("/track/:proxyId", async (req, res) => {
    const proxyId = req.params.proxyId.toUpperCase();
    const entry = lookupProxy(proxyId);

    if (entry == null) {
      res.status(404).send(renderNotFoundPage());
      return;
    }

    const carrier = carrierRegistry.get(entry.carrierId);
    if (carrier == null) {
      res.status(500).send(renderErrorPage(proxyId, "Carrier configuration error. Please contact support."));
      return;
    }

    try {
      const trackInfo = await carrier.track({ trackingNumber: entry.trackingNumber });
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      res.send(renderTrackingPage(proxyId, entry.carrierId, trackInfo, baseUrl));
    } catch (err) {
      serverRootLogger.error("track error in proxy page", { proxyId, err });
      res.status(500).send(renderErrorPage(proxyId, "Unable to fetch tracking info right now. Please try again in a few minutes."));
    }
  });

  app.listen(PORT, () => {
    serverRootLogger.info(`Server ready at http://localhost:${PORT}/graphql`);
    serverRootLogger.info(`Tracking pages available at http://localhost:${PORT}/track/:proxyId`);
    serverRootLogger.info(`Create proxy links via POST http://localhost:${PORT}/api/proxy`);
  });
}

initLogger();
main().catch((err) => {
  serverRootLogger.error("Uncaught error", { error: err });
});
