import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, fileProxyUrl } from "@/lib/api";
import { BookViewTracker } from "@/components/book/book-view-tracker";
import EpubReader from "@/components/reader/epub-reader";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  try {
    const { data: book } = await api.books.get(slug);
    return { title: `Leyendo: ${book.title}` };
  } catch {
    return { title: "Lector" };
  }
}

export default async function ReaderPage({ params }: PageProps) {
  const { slug } = await params;
  let book;
  let errorMessage: string | null = null;

  try {
    const res = await api.books.get(slug);
    book = res.data;
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    // 404 real (slug no existe) vs error temporal (API caída, validación, etc.)
    if (raw.includes("404")) {
      notFound();
    }
    errorMessage = raw;
    console.error("[ReaderPage] api.books.get failed:", raw);
  }

  // Si fallo NO-404 → mostramos pantalla con detalles, no notFound genérico
  if (!book) {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-amber-500" />
        <h1 className="font-serif text-2xl font-bold">No se pudo cargar el libro</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Verifica que el servidor API esté corriendo en localhost:8000 y que
          Meilisearch esté activo.
        </p>
        {errorMessage && (
          <pre className="mt-4 max-w-full overflow-x-auto rounded-md bg-card p-3 text-left text-[10px] text-muted-foreground">
            {errorMessage}
          </pre>
        )}
        <Button asChild className="mt-6">
          <Link href={`/libro/${slug}`}>Volver al detalle</Link>
        </Button>
      </div>
    );
  }

  const isPdf = book.file_type === "pdf";
  const isEpub = book.file_type === "epub" || book.file_type === "both";
  const proxyUrl = fileProxyUrl(book.slug);

  if (isEpub) {
    return (
      <>
        <BookViewTracker slug={book.slug} />
        <EpubReader
          fileUrl={proxyUrl}
          slug={book.slug}
          title={book.title}
          author={book.author?.name}
        />
      </>
    );
  }

  if (isPdf) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <BookViewTracker slug={book.slug} />
        <header className="flex items-center justify-between gap-3 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-xl md:px-6">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link href={`/libro/${book.slug}`}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Volver al detalle</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate font-serif text-base font-bold md:text-lg">{book.title}</h1>
            <p className="truncate text-xs text-muted-foreground">{book.author?.name}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" className="text-primary" title="Abrir en nueva pestaña">
              <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="ghost" size="icon" className="text-primary" title="Descargar">
              <a href={proxyUrl} download>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </header>
        <iframe src={proxyUrl} title={book.title} className="w-full flex-1 border-0 bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] items-center justify-center">
      <p className="text-muted-foreground">Formato no soportado: {book.file_type}</p>
    </div>
  );
}
