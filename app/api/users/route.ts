import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, ApiError } from '@/lib/permissions'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-helper'
import { Role } from '@prisma/client'
import { apiHandler } from '@/lib/api-handler'

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'STAFF']),
  active: z.boolean().optional(),
})

export const GET = apiHandler(async function GET() {
  await requireAdmin()
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  })
  return NextResponse.json(users)
})

export const POST = apiHandler(async function POST(request: NextRequest) {
  await requireAdmin()
  const body = await request.json()
  const parsed = userSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))
  const { name, email, password, role, active } = parsed.data

  const emailNorm = email.toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: emailNorm } })
  if (existing) throw new ApiError(400, 'Email already exists')
  if (!password) throw new ApiError(400, 'Password required')

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email: emailNorm, passwordHash, role: role as Role, active: active ?? true },
    select: { id: true, name: true, email: true, role: true, active: true },
  })
  return NextResponse.json(user, { status: 201 })
})

export const PUT = apiHandler(async function PUT(request: NextRequest) {
  await requireAdmin()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) throw new ApiError(400, 'User id required')
  const body = await request.json()
  const parsed = userSchema.partial().safeParse(body)
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error))
  const { name, email, password, role, active } = parsed.data

  const data: {
    name?: string
    email?: string
    role?: Role
    active?: boolean
    passwordHash?: string
  } = {}
  if (name) data.name = name
  if (email) {
    const emailNorm = email.toLowerCase()
    const dup = await prisma.user.findFirst({ where: { email: emailNorm, NOT: { id } } })
    if (dup) throw new ApiError(400, 'Email already exists')
    data.email = emailNorm
  }
  if (role) data.role = role
  if (active !== undefined) data.active = active
  if (password) data.passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true },
  })
  return NextResponse.json(user)
})

export const DELETE = apiHandler(async function DELETE(request: NextRequest) {
  await requireAdmin()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) throw new ApiError(400, 'User id required')

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) throw new ApiError(404, 'User not found')
  if (target.role === 'ADMIN') {
    throw new ApiError(400, 'Cannot delete an admin user')
  }
  const session = await requireAdmin()
  if (id === session.id) throw new ApiError(400, 'Cannot delete yourself')

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
})