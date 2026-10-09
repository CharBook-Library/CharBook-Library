"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

const ATTRIBUTE_NAMES = ["aria-label", "title", "placeholder", "alt"] as const;
const SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "code",
  "pre",
  "textarea",
  "input",
  "select",
  "[data-no-translate]",
  ".notranslate",
  "[translate='no']",
].join(",");

const enPhrases = new Map<string, string>([
  ["Biblioteca Digital", "Digital Library"],
  ["Miles de clásicos en tu bolsillo", "Thousands of classics in your pocket"],
  ["clásicos", "classics"],
  ["en tu bolsillo", "in your pocket"],
  ["Descubre, lee y guarda obras maestras de la literatura universal. Acceso instantáneo desde cualquier dispositivo.", "Discover, read, and save masterpieces of world literature. Instant access from any device."],
  ["Buscar título, autor o tema...", "Search title, author, or topic..."],
  ["Buscar", "Search"],
  ["Explorar catálogo", "Explore catalog"],
  ["Libros gratuitos", "Free books"],
  ["Destacado", "Featured"],
  ["Destacados", "Featured"],
  ["Las joyas seleccionadas por la biblioteca", "Selected gems from the library"],
  ["Recién añadidos", "Recently added"],
  ["Lo último en llegar a tu biblioteca", "The newest arrivals in your library"],
  ["Más populares", "Most popular"],
  ["Lo que están leyendo otros usuarios", "What other users are reading"],
  ["¿Listo para empezar a leer?", "Ready to start reading?"],
  ["Explora toda nuestra biblioteca. Todos los libros gratuitos están a un click.", "Explore the whole library. Every free book is one click away."],
  ["Ver catálogo completo", "View full catalog"],
  ["Catálogo", "Catalog"],
  ["Cuenta", "Account"],
  ["Inicio", "Home"],
  ["Biblioteca", "Library"],
  ["Hecho con pasión por la lectura.", "Made with passion for reading."],

  ["Catálogo completo", "Full catalog"],
  ["Descubre miles de libros clásicos seleccionados con cariño.", "Discover thousands of carefully selected classic books."],
  ["Sin resultados", "No results"],
  ["No encontramos libros con esos criterios. Intenta cambiar los filtros o la búsqueda.", "We could not find books with those criteria. Try changing the filters or search."],
  ["Filtros", "Filters"],
  ["Ordenar", "Sort"],
  ["Categoría", "Category"],
  ["Idioma", "Language"],
  ["Todos", "All"],
  ["Español", "Spanish"],
  ["English", "English"],
  ["Gratis", "Free"],
  ["Premium", "Premium"],
  ["Limpiar filtros", "Clear filters"],

  ["Billetera y monedas", "Wallet and coins"],
  ["Las monedas se compran aparte de Premium. Usa CharCoins Premium para desbloqueos y Reward para cubrir parte de lecturas normales.", "Coins are purchased separately from Premium. Use Premium CharCoins for unlocks and Reward coins to cover part of regular reads."],
  ["Inicia sesion para ver tus saldos y comprar monedas.", "Sign in to view your balances and buy coins."],
  ["Iniciar sesion", "Sign in"],
  ["CharCoins Premium", "Premium CharCoins"],
  ["CharCoins Reward", "Reward CharCoins"],
  ["Limites Reward", "Reward limits"],
  ["Recompensa diaria", "Daily reward"],
  ["Ganar con anuncio", "Earn with an ad"],
  ["Paquetes de CharCoins Premium", "Premium CharCoins packages"],
  ["Compra monedas para desbloquear capitulos, packs y acceso anticipado cuando aplique.", "Buy coins to unlock chapters, packs, and early access when available."],
  ["Ver beneficios Premium", "View Premium benefits"],
  ["No hay paquetes activos en este momento.", "There are no active packages right now."],
  ["Comprar por", "Buy for"],
  ["Movimientos recientes", "Recent activity"],
  ["Inicia sesion para ver tus movimientos.", "Sign in to view your activity."],
  ["No hay movimientos de los ultimos 7 dias.", "No activity in the last 7 days."],
  ["Cargando movimientos...", "Loading activity..."],
  ["¿Qué son las CharCoins?", "What are CharCoins?"],
  ["Qué son", "What they are"],
  ["Para qué sirven", "What they are for"],
  ["Cómo se consiguen", "How to get them"],
  ["Compra", "Purchase"],
  ["Desbloqueo", "Unlock"],
  ["Anuncio", "Ad"],
  ["Login diario", "Daily login"],
  ["Libro completado", "Book completed"],
  ["Ajuste", "Adjustment"],
  ["Reembolso", "Refund"],

  ["CharBook Premium", "CharBook Premium"],
  ["Lee mejor, desbloquea mas y apoya historias nuevas.", "Read better, unlock more, and support new stories."],
  ["Tres formas claras de leer en CharBook: gratis para explorar, Premium para una experiencia mas comoda y Premium Plus para lectores que siguen series y creadores de cerca.", "Three clear ways to read on CharBook: Free to explore, Premium for a smoother experience, and Premium Plus for readers who closely follow series and creators."],
  ["Ver planes", "View plans"],
  ["Comparar beneficios", "Compare benefits"],
  ["Elige como quieres leer", "Choose how you want to read"],
  ["Las monedas se compran aparte. Los planes cambian beneficios de lectura y suscripcion.", "Coins are purchased separately. Plans change reading and subscription benefits."],
  ["Plan actual", "Current plan"],
  ["Para descubrir libros, seguir perfiles y participar en la comunidad.", "For discovering books, following profiles, and joining the community."],
  ["Para leer con menos friccion y beneficios constantes.", "For reading with less friction and steady benefits."],
  ["Para lectores intensivos que quieren acceso anticipado y mayor apoyo a creadores.", "For power readers who want early access and stronger creator support."],
  ["Catalogo gratuito", "Free catalog"],
  ["Biblioteca personal", "Personal library"],
  ["Resenas y antologias", "Reviews and anthologies"],
  ["Comunidad de lectores", "Reader community"],
  ["Lee todo sin pagar, sin anuncios y sin bloqueos", "Read everything without extra payments, ads, or locks"],
  ["Recomendaciones inteligentes", "Smart recommendations"],
  ["Temas de lectura premium", "Premium reading themes"],
  ["Más tipografías de lectura", "More reading fonts"],
  ["Soporte prioritario", "Priority support"],
  ["Todo lo de Premium", "Everything in Premium"],
  ["Audiolibros IA (próximamente)", "AI audiobooks (coming soon)"],
  ["Elegir voces IA", "Choose AI voices"],
  ["Perfil avanzado con banners", "Advanced profile with banners"],
  ["Acceso anticipado", "Early access"],
  ["Insignia Premium Plus", "Premium Plus badge"],
  ["Resúmenes de libros y capítulos (próximamente)", "Book and chapter summaries (coming soon)"],
  ["Acceso prioritario a nuevas funciones", "Priority access to new features"],
  ["Mayor apoyo a creadores", "More creator support"],
  ["Lo que ganas con Premium", "What you get with Premium"],
  ["Sin anuncios", "No ads"],
  ["Lectura offline", "Offline reading"],
  ["Temas exclusivos", "Exclusive themes"],
  ["Premium Picks", "Premium Picks"],
  ["Personalizacion avanzada", "Advanced personalization"],
  ["Distintivo Premium", "Premium badge"],
  ["Comparacion clara", "Clear comparison"],
  ["Beneficio", "Benefit"],
  ["Lectura sin anuncios.", "Ad-free reading."],
  ["Lectura offline.", "Offline reading."],
  ["Apoyo a creadores", "Creator support"],
  ["Preguntas frecuentes", "Frequently asked questions"],
  ["Empieza tu experiencia Premium hoy", "Start your Premium experience today"],
  ["Mas lectura, mas beneficios y mas apoyo para los creadores que amas.", "More reading, more benefits, and more support for the creators you love."],
  ["Gestionar mi membresia", "Manage my membership"],
  ["Elegir Premium", "Choose Premium"],
  ["Elegir Premium Plus", "Choose Premium Plus"],
  ["Seguir gratis", "Continue for free"],
  ["Mejor experiencia", "Best experience"],
  ["Facturacion y precios reales desde configuracion.", "Billing and real prices come from settings."],
  ["Incluido en Plus", "Included in Plus"],
  ["Abriendo checkout...", "Opening checkout..."],
  ["Mejorar a Plus", "Upgrade to Plus"],

  ["Editar perfil", "Edit profile"],
  ["Tu perfil de lector", "Your reader profile"],
  ["Inicia sesión para editar tu Atelier público.", "Sign in to edit your public Atelier."],
  ["Así te verán otros lectores en CharBook.", "This is how other readers will see you on CharBook."],
  ["Ver perfil", "View profile"],
  ["Foto de perfil", "Profile photo"],
  ["Fondos Premium Plus", "Premium Plus backgrounds"],
  ["Sin banner", "No banner"],
  ["Desbloquear con Premium Plus", "Unlock with Premium Plus"],
  ["Nombre público", "Public name"],
  ["Username", "Username"],
  ["Bio", "Bio"],
  ["Visibilidad", "Visibility"],
  ["Público", "Public"],
  ["Privado", "Private"],
  ["Cancelar", "Cancel"],
  ["Guardar cambios", "Save changes"],

  ["Mi Atelier", "My Atelier"],
  ["Lector desde", "Reader since"],
  ["En el Atelier desde", "In the Atelier since"],
  ["Seguir", "Follow"],
  ["Siguiendo", "Following"],
  ["Pendiente", "Pending"],

  ["Leer", "Read"],
  ["Leer ahora", "Read now"],
  ["Continuar leyendo", "Continue reading"],
  ["Descargar", "Download"],
  ["Capítulos", "Chapters"],
  ["Capítulo", "Chapter"],
  ["Anterior", "Previous"],
  ["Siguiente", "Next"],
  ["Contenido", "Contents"],
  ["Ajustes", "Settings"],
  ["Comentarios", "Comments"],
  ["Favorito", "Favorite"],
  ["Marcador", "Bookmark"],
  ["Pantalla completa", "Fullscreen"],
  ["Salir de pantalla completa", "Exit fullscreen"],
  ["Tema", "Theme"],
  ["Fuente", "Font"],
  ["Tamaño", "Size"],
  ["Interlineado", "Line height"],
  ["Ancho", "Width"],
  ["Alineación", "Alignment"],
  ["Claro", "Light"],
  ["Sepia", "Sepia"],
  ["Oscuro", "Dark"],
  ["Serif", "Serif"],
  ["Sans", "Sans"],
  ["Justificado", "Justified"],
  ["Izquierda", "Left"],
  ["Próximamente", "Coming soon"],
  ["Incluido", "Included"],
  ["No incluido", "Not included"],

  ["Dashboard", "Dashboard"],
  ["Usuarios", "Users"],
  ["Roles", "Roles"],
  ["Reportes", "Reports"],
  ["Categorías", "Categories"],
  ["Autores", "Authors"],
  ["Libros", "Books"],
  ["Nuevo libro", "New book"],
  ["Obras subidas", "Uploaded works"],
  ["Solicitudes Creador", "Creator requests"],
  ["Difusión", "Broadcast"],
  ["Monetización", "Monetization"],
  ["Roles y permisos", "Roles and permissions"],
  ["Panel admin", "Admin panel"],
  ["Gestiona la comunidad: roles, suspensiones y actividad.", "Manage the community: roles, suspensions, and activity."],
  ["Todos los roles", "All roles"],
  ["Enviar CharCoins", "Send CharCoins"],
  ["Membresía", "Membership"],

  ["Studio", "Studio"],
  ["Mis obras", "My works"],
  ["Nueva obra", "New work"],
  ["Estadísticas", "Stats"],
  ["Seguidores", "Followers"],
  ["Configuración", "Settings"],
  ["Publicar", "Publish"],
  ["Guardar", "Save"],
  ["Cargando...", "Loading..."],
  ["Guardando...", "Saving..."],
]);

const enPatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^© (\d{4}) CharBook Library\. Hecho con pasión por la lectura\.$/, (m) => `© ${m[1]} CharBook Library. Made with passion for reading.`],
  [/^Comprar por \$(.+)$/, (m) => `Buy for $${m[1]}`],
  [/^Plan actual: (.+)$/, (m) => `Current plan: ${translateLiteral(m[1])}`],
  [/^Página (\d+) de (\d+)$/, (m) => `Page ${m[1]} of ${m[2]}`],
  [/^Capítulo (\d+)$/, (m) => `Chapter ${m[1]}`],
  [/^(\d+) reseñas$/, (m) => `${m[1]} reviews`],
  [/^(\d+) favoritos$/, (m) => `${m[1]} favorites`],
  [/^Anuncios hoy: (.+)$/, (m) => `Ads today: ${m[1]}`],
];

function translateLiteral(value: string): string {
  return enPhrases.get(value) ?? value;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function translate(value: string): string | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  const direct = enPhrases.get(normalized);
  if (direct) return direct;

  for (const [pattern, replacer] of enPatterns) {
    const match = normalized.match(pattern);
    if (match) return replacer(match);
  }

  return null;
}

function shouldSkipNode(node: Node): boolean {
  const parent = node.parentElement;
  return Boolean(parent?.closest(SKIP_SELECTOR));
}

function localizeTextNode(node: Text): void {
  if (shouldSkipNode(node)) return;
  const next = translate(node.nodeValue ?? "");
  if (next) node.nodeValue = next;
}

function localizeElement(element: Element): void {
  if (element.closest(SKIP_SELECTOR)) return;

  for (const attr of ATTRIBUTE_NAMES) {
    const value = element.getAttribute(attr);
    if (!value) continue;
    const next = translate(value);
    if (next) element.setAttribute(attr, next);
  }
}

function localizeTree(root: ParentNode): void {
  if (root instanceof Element) localizeElement(root);

  const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  while (elementWalker.nextNode()) {
    localizeElement(elementWalker.currentNode as Element);
  }

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (textWalker.nextNode()) {
    localizeTextNode(textWalker.currentNode as Text);
  }
}

export function GlobalTextLocalizer() {
  const locale = useLocale();

  useEffect(() => {
    if (locale !== "en") return;

    let observer: MutationObserver | null = null;
    let cancelled = false;

    const start = () => {
      if (cancelled) return;

      localizeTree(document.body);

      observer = new MutationObserver((mutations) => {
        if (cancelled) return;

      window.requestAnimationFrame(() => {
        if (cancelled) return;

        for (const mutation of mutations) {
          if (mutation.type === "characterData" && mutation.target instanceof Text) {
            localizeTextNode(mutation.target);
            continue;
          }

          if (mutation.type === "attributes" && mutation.target instanceof Element) {
            localizeElement(mutation.target);
            continue;
          }

          mutation.addedNodes.forEach((node) => {
            if (node instanceof Text) {
              localizeTextNode(node);
            } else if (node instanceof Element) {
              localizeTree(node);
            }
          });
        }
      });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...ATTRIBUTE_NAMES],
      });
    };

    const timer = window.setTimeout(start, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [locale]);

  return null;
}
