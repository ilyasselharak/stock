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

  const hamzaEmail = 'hamza@admin.com'
  const hamzaExisting = await prisma.user.findUnique({ where: { email: hamzaEmail } })
  if (!hamzaExisting) {
    const hamzaHash = await bcrypt.hash('hamza123321', 10)
    await prisma.user.create({
      data: { name: 'Hamza', email: hamzaEmail, passwordHash: hamzaHash, role: 'ADMIN' },
    })
    console.log('Admin user created: hamza@admin.com / hamza123321')
  } else {
    console.log('Admin user already exists.')
  }

  const staffEmail = 'staff@example.com'
  const staffExisting = await prisma.user.findUnique({ where: { email: staffEmail } })
  if (!staffExisting) {
    const staffHash = await bcrypt.hash('staff123', 10)
    await prisma.user.create({
      data: { name: 'Employé', email: staffEmail, passwordHash: staffHash, role: 'STAFF' },
    })
    console.log('Staff user created: staff@example.com / staff123')
  } else {
    console.log('Staff user already exists.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
