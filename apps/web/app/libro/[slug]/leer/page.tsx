import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import { BookViewTracker } from "@/components/book/book-view-tracker";
import { ComicViewer } from "./comic-viewer";
import { ComicPdfViewer } from "./comic-pdf-viewer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  try {
    const res = await api.books.pages(slug);
    return { title: `${res.book.title} — Lector` };
  } catch {
    return { title: "Lector" };
  }
}

export default async function ReadPage({ params }: PageProps) {
  const { slug } = await params;

  let res;
  try {
    res = await api.books.pages(slug);
  } catch {
    notFound();
  }

  if (res.book.work_format !== "comic") {
    // Para series el lector es por capítulo; si llegan aquí redirigimos al libro
    notFound();
  }

  // 1) Cómic de IMÁGENES (páginas a nivel de obra) → visor de imágenes.
  if (res.data.length > 0) {
    return (
      <>
        <BookViewTracker slug={slug} />
        <ComicViewer slug={slug} title={res.book.title} pages={res.data} />
      </>
    );
  }

  // 2) Cómic por EPISODIOS (capítulos) → primer episodio. Se prioriza sobre un
  //    posible archivo de obra heredado, para NO mostrar todos los PDFs juntos.
  //    (redirect() lanza una excepción, por eso va fuera del try/catch.)
  let firstNumber: number | null = null;
  try {
    const chs = await api.books.chapters(slug);
    firstNumber = chs.data?.[0]?.number ?? null;
  } catch {
    /* sin capítulos → seguimos a archivo de obra / vacío */
  }
  if (firstNumber !== null) {
    redirect(`/libro/${slug}/capitulo/${firstNumber}`);
  }

  // 3) Cómic de UN SOLO PDF (archivo de obra) → lector webtoon con pdf.js.
  if (res.book.pdf_url) {
    return (
      <>
        <BookViewTracker slug={slug} />
        <ComicPdfViewer slug={slug} title={res.book.title} fileUrl={res.book.pdf_url} />
      </>
    );
  }

  // 4) Sin contenido todavía.
  return (
    <>
      <BookViewTracker slug={slug} />
      <ComicViewer slug={slug} title={res.book.title} pages={res.data} />
    </>
  );
}
