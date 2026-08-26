export function PageTitle({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <p className="kicker">{kicker}</p>
      <h1 className="font-heading mt-1 text-3xl tracking-tight md:text-[2.15rem]">{title}</h1>
      {children ? <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</div> : null}
    </div>
  )
}
