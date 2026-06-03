const brandImages: Record<string, string> = {
  starbucks:
    "https://images.unsplash.com/photo-1558857563-c0c3a62d0f8f?w=600&h=300&fit=crop",
  "the coffee bean & tea leaf":
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=300&fit=crop",
  "coffee bean & tea leaf":
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=300&fit=crop",
  "coffee bean and tea leaf":
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=300&fit=crop",
  "dunkin'":
    "https://images.unsplash.com/photo-1559041289-2e1b6f6e69bf?w=600&h=300&fit=crop",
  "dunkin donuts":
    "https://images.unsplash.com/photo-1559041289-2e1b6f6e69bf?w=600&h=300&fit=crop",
  "dunkin' donuts":
    "https://images.unsplash.com/photo-1559041289-2e1b6f6e69bf?w=600&h=300&fit=crop",
  "bo's coffee":
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=300&fit=crop",
  "bos coffee":
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=300&fit=crop",
  figaro:
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=300&fit=crop",
  "seattle's best":
    "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=300&fit=crop",
  "tim hortons":
    "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=600&h=300&fit=crop",
  "coffee project":
    "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=600&h=300&fit=crop",
  "toby's estate":
    "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&h=300&fit=crop",
  "ucc coffee":
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=300&fit=crop",
  "st. marc":
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&h=300&fit=crop",
  wildflour:
    "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&h=300&fit=crop",
  yardstick:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=300&fit=crop",
  kuppa:
    "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=600&h=300&fit=crop",
  "single origin":
    "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&h=300&fit=crop",
};

const categoryImages: Record<string, string[]> = {
  Specialty: [
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&h=300&fit=crop",
  ],
  Local: [
    "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&h=300&fit=crop",
  ],
  Chain: [
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1442975631115-c4f7b05b8a2c?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=300&fit=crop",
  ],
  Bakery: [
    "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1555507036-ab1f4038024b?w=600&h=300&fit=crop",
    "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&h=300&fit=crop",
  ],
};

const nameIndex: Record<string, number> = {};

function getBrandKey(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key] of Object.entries(brandImages)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

export function getImageForLocation(
  name: string,
  category: string,
  osmImage?: string | null
): string {
  if (osmImage) {
    const img = osmImage.trim();
    if (img.startsWith("http") && !img.includes("facebook.com") && !img.includes("imgur.com")) {
      return img;
    }
  }

  const brandKey = getBrandKey(name);
  if (brandKey) return brandImages[brandKey];

  const key = `${category}:${name}`;
  if (!(key in nameIndex)) {
    nameIndex[key] = Object.keys(nameIndex).length;
  }
  const images = categoryImages[category] || categoryImages.Local;
  return images[nameIndex[key] % images.length];
}
