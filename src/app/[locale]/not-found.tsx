import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default async function LocaleNotFound() {
  await getLocale();
  const [notFound, actions] = await Promise.all([
    getTranslations("notFound"),
    getTranslations("actions"),
  ]);

  return (
    <Container className="flex flex-1 items-center py-16">
      <EmptyState
        action={
          <Link
            className={buttonVariants({ className: "rounded-md" })}
            href="/"
          >
            {actions("backToHome")}
          </Link>
        }
        description={notFound("description")}
        icon="error"
        title={notFound("title")}
      />
    </Container>
  );
}
