'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Phone, Mail, Award } from 'lucide-react'
import { Button } from '@/components/ui'

interface AgentProfileCardProps {
  name: string
  title: string
  phone: string
  email: string
  bio: string
  photo: string
  stats?: Array<{ label: string; value: string }>
}

export function AgentProfileCard({ name, title, phone, email, bio, photo, stats }: AgentProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-3xl overflow-hidden bg-white border border-charcoal-100 shadow-sm"
    >
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="relative aspect-[4/5] md:aspect-auto">
          <Image src={photo} alt={name} fill className="object-cover object-top" sizes="50vw" />
        </div>
        <div className="p-8 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <Award size={16} className="text-gold-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gold-600">{title}</span>
          </div>
          <h2 className="font-serif text-3xl font-bold text-charcoal-900 mb-4">{name}</h2>
          <p className="text-charcoal-600 leading-relaxed mb-6">{bio}</p>

          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-6 py-5 border-y border-charcoal-100">
              {stats.map((s, i) => (
                <div key={i} className="text-center">
                  <p className="font-serif text-2xl font-bold text-charcoal-900">{s.value}</p>
                  <p className="text-xs text-charcoal-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm text-charcoal-600 hover:text-gold-600 transition-colors">
              <Phone size={14} /> {phone}
            </a>
            <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm text-charcoal-600 hover:text-gold-600 transition-colors">
              <Mail size={14} /> {email}
            </a>
            <Button variant="gold" className="mt-2" asChild>
              <a href="/contact">Schedule a Consultation</a>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
