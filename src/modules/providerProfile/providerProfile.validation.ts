import { z } from "zod";
import { uuidField } from "../../utils/validationFields";

const params = z.object({ providerId: uuidField("Provider id") });

export const providerProfileValidation = { params };
