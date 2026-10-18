import { z } from "zod";
import { uuidField } from "../../utils/validationFields";

const gearParams = z.object({ gearId: uuidField("Gear id") });

export const favoriteValidation = { gearParams };
