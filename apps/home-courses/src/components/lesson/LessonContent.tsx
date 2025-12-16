interface LessonContentProps {
  html: string;
}

export function LessonContent({ html }: LessonContentProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <article 
        className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
