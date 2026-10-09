import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnthologyDetail } from "@/components/anthology/anthology-detail";
import { api } from "@/lib/api";
import type { Anthology } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data } = await api.anthologies.get(slug);
    return {
      title: `${data.title} · Antología en CharBook`,
      description:
        data.description?.slice(0, 160) ??
        `Una antología curada de ${data.books_count} libros en CharBook Library.`,
    };
  } catch {
    return { title: "Antología no encontrada" };
  }
}

export default async function AnthologyPage({ params }: PageProps) {
  const { slug } = await params;

  let anthology: Anthology;
  try {
    const res = await api.anthologies.get(slug);
    anthology = res.data;
  } catch {
    notFound();
  }

  return <AnthologyDetail initial={anthology} />;
}
