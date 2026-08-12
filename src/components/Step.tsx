export function Step({ number, title }: { number: string; title: string }) {
  return <div className="step-heading"><span>{number}</span><h2>{title}</h2></div>
}
