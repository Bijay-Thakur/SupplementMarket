import { cn } from "@/lib/utils/cn";

/** Fluid page wrapper with small, responsive gutters. Individual pages may add a max-width. */
export function Container({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full min-w-0 max-w-none px-4 sm:px-5 lg:px-6 2xl:px-8",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
