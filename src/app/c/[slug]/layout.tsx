import Link from 'next/link'
import Image from 'next/image'

export default function PublicEventLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-scren flex flex-col bg-background">
      <header className="bg-primary-foreground h-14 px-4 flex items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative w-7 h-7 bg-primary rounded-md">
            <Image
              src="/mascot.png"
              alt="ChurrasKing mascote"
              fill
              sizes="28px"
              priority
              className="object-contain"
            />
          </div>
          <span className="text-white font-medium">
            Churras<span className="text-primary">King</span>
          </span>
        </Link>
      </header>
      {children}
    </div>
  )
}
