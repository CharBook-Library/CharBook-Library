import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Términos de Servicio",
  description:
    "Términos y condiciones de uso de CharBook Library: cuentas, contenido, CharCoins, suscripciones y derechos de los creadores.",
};

export default function TerminosPage() {
  return (
    <LegalPage
      kind="terms"
      title="Términos de Servicio"
      updatedAt="23 de junio de 2026"
      intro="Estos términos regulan el uso de CharBook Library, la plataforma para leer, publicar y apoyar historias. Al crear una cuenta o usar el servicio aceptas estas condiciones, así que te pedimos leerlas con calma."
      sections={[
        {
          id: "servicio",
          title: "El servicio",
          body: (
            <>
              <p>
                CharBook Library («CharBook», «nosotros») es una biblioteca digital donde los
                lectores descubren obras (libros, series por capítulos y cómics) y los creadores
                publican su propio contenido. Algunas funciones son gratuitas y otras requieren
                CharCoins o una suscripción (Premium / Premium Plus).
              </p>
              <p>
                Podemos actualizar, añadir o retirar funciones para mejorar la plataforma. Si un
                cambio afecta de forma importante tus derechos, lo anunciaremos dentro del servicio.
              </p>
            </>
          ),
        },
        {
          id: "cuenta",
          title: "Tu cuenta",
          body: (
            <>
              <p>
                Necesitas una cuenta para publicar, comentar, comprar CharCoins o guardar tu
                biblioteca. Debes proporcionar información veraz, mantener tu contraseña segura y
                verificar tu correo electrónico para habilitar funciones sensibles (por ejemplo,
                publicar obras).
              </p>
              <p>
                Eres responsable de la actividad realizada desde tu cuenta. Si detectas un acceso no
                autorizado, cambia tu contraseña y contáctanos de inmediato. Podemos suspender
                cuentas que incumplan estos términos o pongan en riesgo a la comunidad.
              </p>
            </>
          ),
        },
        {
          id: "contenido-usuarios",
          title: "Contenido de los creadores",
          body: (
            <>
              <p>
                Al publicar una obra confirmas que eres su autor o titular de los derechos, o que
                cuentas con autorización para publicarla. El contenido sigue siendo tuyo: solo nos
                concedes una licencia no exclusiva para alojarlo, mostrarlo y distribuirlo dentro de
                CharBook (incluida su lectura en la app móvil y las vistas previas).
              </p>
              <p>
                No está permitido subir contenido que infrinja derechos de autor, contenga malware,
                sea ilegal o incumpla nuestras normas de clasificación por edad. Los archivos subidos
                pasan por validaciones de seguridad y las infracciones pueden retirarse sin aviso.
              </p>
              <p>
                Si crees que una obra infringe tus derechos, escríbenos a{" "}
                <a href="mailto:soporte@charbook.app" className="text-primary hover:underline">
                  soporte@charbook.app
                </a>{" "}
                con la información de la obra y acreditación de titularidad.
              </p>
            </>
          ),
        },
        {
          id: "charcoins",
          title: "CharCoins, compras y suscripciones",
          body: (
            <>
              <p>
                Las CharCoins son la moneda virtual de CharBook: sirven para desbloquear capítulos y
                apoyar a los creadores. No son dinero, no generan intereses y solo pueden usarse
                dentro de la plataforma. Las CharCoins de regalo (Reward) pueden tener límites de uso.
              </p>
              <p>
                Los pagos se procesan por proveedores externos seguros (por ejemplo, Stripe); no
                almacenamos los datos completos de tu tarjeta. Salvo que la ley diga lo contrario,
                las compras de CharCoins y los periodos de suscripción ya iniciados no son
                reembolsables. Puedes cancelar tu suscripción en cualquier momento y conservarás los
                beneficios hasta el final del periodo pagado.
              </p>
              <p>
                El contenido que desbloqueas queda ligado a tu cuenta; no puede revenderse ni
                transferirse.
              </p>
            </>
          ),
        },
        {
          id: "conducta",
          title: "Normas de conducta",
          body: (
            <>
              <p>En CharBook no se permite:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Acoso, discurso de odio o suplantación de identidad.</li>
                <li>Spam, manipulación de reseñas, likes o estadísticas.</li>
                <li>Extraer contenido de forma masiva (scraping) o eludir el paywall.</li>
                <li>Publicar datos personales de terceros sin su consentimiento.</li>
              </ul>
              <p>
                Puedes reportar contenido o usuarios desde la propia plataforma; nuestro equipo de
                moderación revisa cada reporte.
              </p>
            </>
          ),
        },
        {
          id: "propiedad",
          title: "Propiedad intelectual de CharBook",
          body: (
            <p>
              La marca CharBook, el diseño de la plataforma, su código y sus elementos gráficos son
              propiedad de CharBook Library o de sus licenciantes. Estos términos no te conceden
              ningún derecho sobre ellos más allá del uso normal del servicio.
            </p>
          ),
        },
        {
          id: "responsabilidad",
          title: "Limitación de responsabilidad",
          body: (
            <>
              <p>
                Trabajamos para que CharBook esté disponible y seguro, pero el servicio se ofrece
                «tal cual»: no garantizamos disponibilidad ininterrumpida ni ausencia total de
                errores. El contenido publicado por los creadores es responsabilidad de sus autores.
              </p>
              <p>
                En la medida permitida por la ley, nuestra responsabilidad total frente a ti se
                limita al importe pagado a CharBook en los 12 meses anteriores al hecho que la
                origine.
              </p>
            </>
          ),
        },
        {
          id: "terminacion",
          title: "Terminación",
          body: (
            <p>
              Puedes eliminar tu cuenta cuando quieras desde Ajustes. Nosotros podemos suspender o
              cerrar cuentas que incumplan estos términos de forma grave o reiterada. Al cerrarse una
              cuenta, las CharCoins no utilizadas se pierden salvo que la ley exija lo contrario.
            </p>
          ),
        },
        {
          id: "cambios",
          title: "Cambios a estos términos",
          body: (
            <p>
              Podemos modificar estos términos para reflejar cambios del servicio o requisitos
              legales. Publicaremos la versión vigente en esta página con su fecha de actualización;
              los cambios relevantes se anunciarán dentro de la plataforma. Seguir usando CharBook
              tras un cambio implica aceptarlo.
            </p>
          ),
        },
      ]}
    />
  );
}
