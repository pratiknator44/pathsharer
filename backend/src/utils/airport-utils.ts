export interface Airport {
  name: string;
  city: string;
  lat: number;
  lng: number;
}

export const indiaAirports: Record<string, Airport> = {
  DEL: { name: "Indira Gandhi International Airport", city: "Delhi", lat: 28.5562, lng: 77.1 },
  BOM: { name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", lat: 19.0896, lng: 72.8656 },
  BLR: { name: "Kempegowda International Airport", city: "Bengaluru", lat: 13.1986, lng: 77.7066 },
  MAA: { name: "Chennai International Airport", city: "Chennai", lat: 12.9941, lng: 80.1709 },
  CCU: { name: "Netaji Subhas Chandra Bose International Airport", city: "Kolkata", lat: 22.6547, lng: 88.4467 },
  HYD: { name: "Rajiv Gandhi International Airport", city: "Hyderabad", lat: 17.2403, lng: 78.4294 },
  AMD: { name: "Sardar Vallabhbhai Patel International Airport", city: "Ahmedabad", lat: 23.0772, lng: 72.6347 },
  PNQ: { name: "Pune International Airport (Lohegaon)", city: "Pune", lat: 18.5822, lng: 73.9197 },
  GOI: { name: "Dabolim Airport", city: "Goa (South)", lat: 15.3808, lng: 73.8314 },
  GOX: { name: "Manohar International Airport (Mopa)", city: "Goa (North)", lat: 15.743, lng: 73.864 },
  COK: { name: "Cochin International Airport", city: "Kochi", lat: 10.152, lng: 76.4019 },
  TRV: { name: "Trivandrum International Airport", city: "Thiruvananthapuram", lat: 8.4821, lng: 76.9199 },
  CCJ: { name: "Calicut International Airport", city: "Kozhikode", lat: 11.1368, lng: 75.9553 },
  JAI: { name: "Jaipur International Airport", city: "Jaipur", lat: 26.8242, lng: 75.8122 },
  LKO: { name: "Chaudhary Charan Singh International Airport", city: "Lucknow", lat: 26.7606, lng: 80.8893 },
  VNS: { name: "Lal Bahadur Shastri International Airport", city: "Varanasi", lat: 25.4524, lng: 82.8593 },
  GAU: { name: "Lokpriya Gopinath Bordoloi International Airport", city: "Guwahati", lat: 26.1061, lng: 91.5859 },
  PAT: { name: "Jay Prakash Narayan International Airport", city: "Patna", lat: 25.5913, lng: 85.088 },
  BBI: { name: "Biju Patnaik International Airport", city: "Bhubaneswar", lat: 20.2444, lng: 85.8178 },
  IXC: { name: "Chandigarh International Airport", city: "Chandigarh", lat: 30.6735, lng: 76.7885 },
  ATQ: { name: "Sri Guru Ram Dass Jee International Airport", city: "Amritsar", lat: 31.7096, lng: 74.7973 },
  SXR: { name: "Srinagar International Airport", city: "Srinagar", lat: 33.9871, lng: 74.7742 },
  IDR: { name: "Devi Ahilyabai Holkar Airport", city: "Indore", lat: 22.7218, lng: 75.8011 },
  NAG: { name: "Dr. Babasaheb Ambedkar International Airport", city: "Nagpur", lat: 21.0922, lng: 79.0472 },
  IXR: { name: "Birsa Munda Airport", city: "Ranchi", lat: 23.3143, lng: 85.3217 },
  RPR: { name: "Swami Vivekananda Airport", city: "Raipur", lat: 21.1804, lng: 81.7388 },
  CJB: { name: "Coimbatore International Airport", city: "Coimbatore", lat: 11.03, lng: 77.0434 },
  IXM: { name: "Madurai Airport", city: "Madurai", lat: 9.8345, lng: 78.0934 },
  VTZ: { name: "Visakhapatnam Airport", city: "Visakhapatnam", lat: 17.7212, lng: 83.2245 },
  IXB: { name: "Bagdogra Airport", city: "Siliguri", lat: 26.6812, lng: 88.3286 },
  IMF: { name: "Imphal International Airport", city: "Imphal", lat: 24.76, lng: 93.8967 },
  IXZ: { name: "Veer Savarkar International Airport", city: "Port Blair", lat: 11.641, lng: 92.7297 },
  BDQ: { name: "Vadodara Airport", city: "Vadodara", lat: 22.3362, lng: 73.2263 },
  IXE: { name: "Mangaluru International Airport", city: "Mangaluru", lat: 12.9613, lng: 74.8901 },
};

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two points in km (haversine). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Returns the airport (with its IATA code and distance) within `radiusKm`
 * of the given coordinates, or null if none. If several qualify, the closest wins.
 */
export function findAirportNear(
  lat: number,
  lng: number,
  radiusKm = 2
): (Airport & { code: string; distanceKm: number }) | null {
  let best: (Airport & { code: string; distanceKm: number }) | null = null;

  for (const [code, airport] of Object.entries(indiaAirports)) {
    const d = distanceKm(lat, lng, airport.lat, airport.lng);
    if (d <= radiusKm && (best === null || d < best.distanceKm)) {
      best = { code, ...airport, distanceKm: d };
    }
  }
  return best;
}

// Example:
// findAirportNear(28.5562, 77.1005);
// -> { code: "DEL", name: "Indira Gandhi International Airport", ..., distanceKm: ~0.05 }