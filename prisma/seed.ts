import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  const email = 'admin@example.com'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) {
    const passwordHash = await bcrypt.hash('admin123', 10)
    await prisma.user.create({
      data: { name: 'Administrator', email, passwordHash, role: 'ADMIN' },
    })
    console.log('Admin user created: admin@example.com / admin123')
  } else {
    console.log('Admin user already exists.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
