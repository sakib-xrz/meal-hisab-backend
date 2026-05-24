import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Generate a URL-friendly slug from a string
 */
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

/**
 * Generate a unique slug for a given Prisma model
 */
const generateUniqueSlug = async (
  name: string,
  model: Prisma.ModelName,
): Promise<string> => {
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let counter = 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaModel = (prisma as any)[model];

  if (!prismaModel) {
    throw new Error(`Model "${model}" does not exist in Prisma client`);
  }

  while (true) {
    const existing = await prismaModel.findUnique({
      where: { slug },
    });

    if (!existing) break;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

export { slugify, generateUniqueSlug };
