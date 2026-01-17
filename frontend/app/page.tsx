"use client"

import { useRouter } from "next/navigation"
import { LandingPage } from "@/components/landing-page"

export default function Home() {
  const router = useRouter()

  const handleGetStarted = () => {
    router.push("/library")
  }

  return <LandingPage onGetStarted={handleGetStarted} />
}
