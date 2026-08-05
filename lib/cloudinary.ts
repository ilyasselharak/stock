import * as cloudinaryNS from 'cloudinary'

const cloudinary = cloudinaryNS.v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function uploadImage(base64: string, folder = 'stock') {
  try {
    const result = await cloudinary.uploader.upload(base64, {
      folder,
      resource_type: 'image',
      transformation: [{ width: 800, crop: 'limit' }],
    })
    return result.secure_url
  } catch (err) {
    console.error('Cloudinary upload error:', err)
    throw new Error('Image upload failed')
  }
}

export async function deleteImage(url?: string | null) {
  if (!url) return
  try {
    const parts = url.split('/')
    const file = parts[parts.length - 1]
    const publicId = file.replace(/\.[^/.]+$/, '')
    await cloudinary.uploader.destroy(`stock/${publicId}`)
  } catch (err) {
    console.error('Cloudinary delete error:', err)
  }
}
