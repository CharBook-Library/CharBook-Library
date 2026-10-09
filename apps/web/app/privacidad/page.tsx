import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo CharBook Library recopila, usa y protege tus datos: cuenta, lectura, pagos, cookies y tus derechos.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      kind="privacy"
      title="Política de Privacidad"
      updatedAt="23 de junio de 2026"
      intro="Tu confianza es la base de CharBook. Aquí explicamos con claridad qué datos recopilamos, para qué los usamos y qué control tienes sobre ellos. No vendemos tus datos personales."
      sections={[
        {
          id: "datos",
          title: "Qué datos recopilamos",
          body: (
            <>
              <p>Recopilamos solo lo necesario para que la plataforma funcione:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Cuenta:</strong> nombre, correo electrónico, nombre de usuario, contraseña
                  (cifrada) y, si inicias sesión con Google, tu identificador y avatar de Google.
                </li>
                <li>
                  <strong>Perfil:</strong> biografía, avatar y preferencias que decidas añadir.
                </li>
                <li>
                  <strong>Actividad:</strong> obras leídas, favoritos, reseñas, comentarios,
                  progreso de lectura y desbloqueos — es lo que permite tu biblioteca y las
                  recomendaciones.
                </li>
                <li>
                  <strong>Pagos:</strong> el historial de compras (CharCoins, suscripciones). Los
                  datos de tarjeta los procesa directamente el proveedor de pagos; nunca llegan a
                  nuestros servidores.
                </li>
                <li>
                  <strong>Técnicos:</strong> dirección IP, tipo de dispositivo y registros de
                  seguridad (por ejemplo, la auditoría de archivos subidos).
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "uso",
          title: "Para qué los usamos",
          body: (
            <>
              <ul className="list-disc space-y-1 pl-5">
                <li>Prestar el servicio: tu cuenta, tu biblioteca, tus compras.</li>
                <li>Personalizar la experiencia (continuar leyendo, recomendaciones).</li>
                <li>Pagar a los creadores lo que generan sus obras.</li>
                <li>Seguridad: prevenir fraude, abuso y accesos no autorizados.</li>
                <li>Comunicaciones esenciales: verificación de correo, avisos de cuenta.</li>
              </ul>
              <p>
                Base legal: ejecución del contrato (darte el servicio), interés legítimo (seguridad
                y mejora) y tu consentimiento (comunicaciones opcionales), según corresponda.
              </p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              Usamos cookies estrictamente funcionales: mantener tu sesión iniciada (token de
              acceso), recordar tu idioma y tus preferencias de lectura. No usamos cookies de
              publicidad de terceros. Puedes borrar las cookies desde tu navegador; al hacerlo se
              cerrará tu sesión.
            </p>
          ),
        },
        {
          id: "terceros",
          title: "Con quién compartimos datos",
          body: (
            <>
              <p>Solo con proveedores imprescindibles para operar, y únicamente lo necesario:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Google</strong> — inicio de sesión OAuth (si eliges ese método).
                </li>
                <li>
                  <strong>Proveedor de pagos (Stripe)</strong> — procesar compras y suscripciones.
                </li>
                <li>
                  <strong>Almacenamiento en la nube (Cloudflare R2)</strong> — alojar portadas y
                  archivos de las obras.
                </li>
                <li>
                  <strong>Proveedor de correo</strong> — enviar códigos de verificación y avisos.
                </li>
              </ul>
              <p>
                Nunca vendemos tus datos ni los compartimos con anunciantes. Podemos revelar
                información si una autoridad competente lo exige legalmente.
              </p>
            </>
          ),
        },
        {
          id: "conservacion",
          title: "Cuánto tiempo los guardamos",
          body: (
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Si la eliminas, borramos o
              anonimizamos tu información personal en un plazo razonable, salvo lo que debamos
              conservar por obligaciones legales (por ejemplo, registros de facturación) o
              seguridad (registros de auditoría, por tiempo limitado).
            </p>
          ),
        },
        {
          id: "derechos",
          title: "Tus derechos",
          body: (
            <>
              <p>
                Puedes acceder, corregir o eliminar tus datos, así como oponerte a ciertos usos y
                pedir su portabilidad. La mayoría de estas acciones están disponibles directamente
                en <strong>Ajustes</strong> (editar perfil, cambiar correo, eliminar cuenta).
              </p>
              <p>
                Para cualquier otra solicitud escribe a{" "}
                <a href="mailto:soporte@charbook.app" className="text-primary hover:underline">
                  soporte@charbook.app
                </a>{" "}
                desde el correo asociado a tu cuenta y responderemos lo antes posible.
              </p>
            </>
          ),
        },
        {
          id: "seguridad",
          title: "Seguridad",
          body: (
            <p>
              Protegemos tu información con cifrado de contraseñas, tokens de sesión con caducidad,
              verificación en dos pasos opcional (2FA y passkeys), validación multicapa de todos los
              archivos subidos y registros de auditoría. Ningún sistema es infalible, pero si
              detectamos un incidente que afecte tus datos te lo notificaremos.
            </p>
          ),
        },
        {
          id: "menores",
          title: "Menores de edad",
          body: (
            <p>
              CharBook clasifica el contenido por edades (Todos, 13+, 18+). No dirigimos el servicio
              a menores de 13 años ni recopilamos su información a sabiendas; si detectamos una
              cuenta de un menor de esa edad, la eliminaremos.
            </p>
          ),
        },
        {
          id: "cambios-privacidad",
          title: "Cambios a esta política",
          body: (
            <p>
              Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha. Cuando el
              cambio sea significativo (nuevos usos de datos, nuevos proveedores), lo avisaremos
              dentro de la plataforma antes de que entre en vigor.
            </p>
          ),
        },
      ]}
    />
  );
}
