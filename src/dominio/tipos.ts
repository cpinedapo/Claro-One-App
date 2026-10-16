/**
 * Lo que el producto agrega a las entidades del kit, sin redefinirlas.
 *
 * `Empleado` sigue siendo el de `@arc2-0/claro-one-kit/dominio`. El producto solo le suma lo que
 * el login necesita y el contrato del kit todavía no tiene (ver docs/hallazgos.md · H-001).
 */
import type { Empleado } from '@arc2-0/claro-one-kit/dominio';

/** `permisosDirectos`: los que se le encendieron a la persona, uno por uno (H-032). Los de sus roles no van aquí. */
export type EmpleadoConCorreo = Empleado & {
  email: string | null;
  permisosDirectos: string[];
  /** Sus cargos (códigos de Datos base, H-038): de ellos salen su área y sus roles. `puesto` es el primero. */
  cargos: string[];
};
