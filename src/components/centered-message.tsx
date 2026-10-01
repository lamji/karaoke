import { Loader2Icon } from "lucide-react";

type CenteredMessageProps = {
  icon: string;
  title: string;
  text?: string;
  spinner?: boolean;
  children?: React.ReactNode;
};

/** Full-page status message (loading, not found, locked, ...). */
export function CenteredMessage({ icon, title, text, spinner, children }: CenteredMessageProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="text-5xl">{icon}</span>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        {spinner && <Loader2Icon className="size-5 animate-spin" />}
        {title}
      </h1>
      {text && <p className="text-muted-foreground">{text}</p>}
      {children}
    </main>
  );
}
