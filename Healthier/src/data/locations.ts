export interface Location {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  description: string;
  rating: number;
  image?: string;
  opening_hours?: string | null;
  phone?: string | null;
  website?: string | null;
  wifi?: string | null;
  outdoor_seating?: string | null;
  parking?: string | null;
  wheelchair?: string | null;
}

export const healthyLocations: Location[] = [];
