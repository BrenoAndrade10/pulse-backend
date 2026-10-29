import * as yup from 'yup';
import { isUuidV7 } from '../../../../shared/presentation/validators/isUuidV7';
import { UserRole } from '../../domain/enums/UserRole';
import { passwordSchema } from './PasswordSchema';

export const registerTenantUserSchema = yup
  .object({
    firstName: yup.string().trim().required('O primeiro nome é obrigatório.'),
    lastName: yup.string().trim().optional(),
    email: yup
      .string()
      .trim()
      .lowercase()
      .email('Informe um e-mail válido.')
      .required('O e-mail é obrigatório.'),
    password: passwordSchema,
    tenantId: yup
      .string()
      .trim()
      .test('uuid-v7', 'Informe um tenantId válido.', (value) =>
        value === undefined ? true : isUuidV7(value),
      )
      .optional(),
    tenantName: yup.string().trim().min(2).max(180).optional(),
    role: yup
      .mixed<UserRole>()
      .oneOf(Object.values(UserRole), 'Informe um perfil de usuário válido.')
      .optional(),
  })
  .required()
  .noUnknown(true, 'Informe apenas campos permitidos.');

export type RegisterTenantUserSchemaInput = yup.InferType<
  typeof registerTenantUserSchema
>;
