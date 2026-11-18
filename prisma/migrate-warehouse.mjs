// One-time migration for the warehouse feature.
//
// Before it, `Product.quantity` held all the stock (warehouse + both stores). After it,
// `quantity` is the stores' stock and `warehouseQuantity` the warehouse's. Since we don't
// know yet how the old stock is split, everything goes to the warehouse and the stores
// start at 0. Then count the stores on the Inventory page and apply the count with
// "Garder le total : prendre la différence dans l’entrepôt" ticked.
//
// Each product with stock gets a TRANSFER movement (stores → warehouse) in the history.
// Only products without `warehouseQuantity` are touched, so it is safe to run twice.
//
//   DATABASE_URL="mongodb+srv://..." node prisma/migrate-warehouse.mjs           (dry run)
//   DATABASE_URL="mongodb+srv://..." node prisma/migrate-warehouse.mjs --apply

import { PrismaClient } from '@prisma/client'

const apply = process.argv.includes('--apply')
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.product.findRaw({
    filter: { warehouseQuantity: { $exists: false } },
    options: { projection: { _id: 1, name: 1, quantity: 1 } },
  })
  const products = docs.map((d) => ({ id: d._id.$oid, name: d.name, quantity: Number(d.quantity) || 0 }))
  const withStock = products.filter((p) => p.quantity > 0)
  const units = withStock.reduce((s, p) => s + p.quantity, 0)

  console.log(`${products.length} product(s) to migrate, ${withStock.length} with stock (${units} units moved to the warehouse).`)
  if (!apply) {
    console.log('Dry run: nothing changed. Re-run with --apply to migrate.')
    return
  }
  if (products.length === 0) return

  await prisma.$runCommandRaw({
    update: 'Product',
    updates: [
      {
        q: { _id: { $in: products.map((p) => ({ $oid: p.id })) }, warehouseQuantity: { $exists: false } },
        u: [{ $set: { warehouseQuantity: { $max: [0, { $ifNull: ['$quantity', 0] }] }, quantity: 0 } }],
        multi: true,
      },
    ],
  })

  if (withStock.length > 0) {
    await prisma.stockMovement.createMany({
      data: withStock.map((p) => ({
        productId: p.id,
        quantity: p.quantity,
        type: 'TRANSFER',
        location: 'WAREHOUSE',
        reason: 'Mise en place de l’entrepôt : tout le stock existant passe en entrepôt',
      })),
    })
  }
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
