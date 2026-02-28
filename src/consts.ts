import type { IconMap, SocialLink, Site } from '@/types'

export const SITE: Site = {
  title: "angad's blog",
  description: 'my personal website and blog',
  href: 'https://angad.page',
  author: 'angad',
  locale: 'en-US',
  featuredPostCount: 3,
  postsPerPage: 5,
}

export const NAV_LINKS: SocialLink[] = [
  { href: '/blog', label: 'blog' },
  { href: '/about', label: 'about' },
  { href: '/tags', label: 'tags' },
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://github.com/onlycs',
    label: 'GitHub',
  },
  {
    href: 'mailto:angad@angad.page',
    label: 'Email',
  },
  {
    href: '/rss.xml',
    label: 'RSS',
  },
]

export const ICON_MAP: IconMap = {
  Website: 'lucide:globe',
  GitHub: 'lucide:github',
  LinkedIn: 'lucide:linkedin',
  Twitter: 'lucide:twitter',
  Email: 'lucide:mail',
  RSS: 'lucide:rss',
}
