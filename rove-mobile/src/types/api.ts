// Verified against backend/index.js and backend/security.js at checkpoint cc91433.
export type BackendFilter = 'adventure_sports' | 'entertainment' | 'nature_park' | 'restaurant';
export type CostConfidence = 'high' | 'medium' | 'low';

export interface ReverseGeocodeRequest { lat: number; lng: number }
export interface ReverseGeocodeResponse { address: string }

export interface ItineraryRequest {
  budget: number;
  location: string;
  people?: number;
  radius?: number;
  filters?: BackendFilter[];
  hasPrivateVehicle?: boolean;
  mileage?: number | null;
}

export interface ItineraryPlace {
  place_id: string;
  name: string;
  address?: string;
  rating: number | null;
  photoUrl: string | null;
  latitude: number;
  longitude: number;
  type: string;
  people: number;
  travelCost: number;
  travelTime: string;
  distance: string;
  roundTripDistKm: number;
  activities: string[];
  aiDescription: string;
  roughCostPerPerson: number;
  description: string;
  costPerPerson: number;
  activityCost: number;
  totalOptionCost: number;
  costConfidence: CostConfidence;
  costNote: string;
}

export interface ApiWarning { code: string; message: string }
export interface ItineraryResponse {
  itinerary: ItineraryPlace[];
  // Current backend sets this to the first option's cost, or zero for no options.
  totalCost: number;
  budget: number;
  people: number;
  aiSummary: string;
  warnings?: ApiWarning[];
}

// Rate limit responses may omit code; other handled errors include one.
export interface ApiErrorResponse { error: string; code?: string }
