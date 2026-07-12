import { z } from "zod";
import { ResponseFormatSchema } from "./common.js";

export const ServerInfoSchema = z
  .object({
    response_format: ResponseFormatSchema
  })
  .strict();

export type ServerInfoInput = z.infer<typeof ServerInfoSchema>;
