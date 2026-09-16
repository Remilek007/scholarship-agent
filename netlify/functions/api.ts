import serverless from "serverless-http";
import { app } from "../../services/api/src/index.js";

export const handler = serverless(app);
