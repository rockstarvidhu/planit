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

// POST /api/plans/create: backend/planning-orchestrator.js, not the legacy itinerary route.
export type PlanningCategory = 'Cafe' | 'Food' | 'Movies' | 'Outdoors' | 'Entertainment' | 'Shopping';
export type PlanningStatus = 'ready' | 'provisional' | 'insufficient_data' | 'no_feasible_plan' | 'provider_unavailable';
export interface PlanCreateRequest {
  origin: { latitude: number; longitude: number };
  startAt: string;
  availableMinutes: number;
  budgetAmount: number;
  budgetMode: 'total' | 'perPerson';
  people: number;
  categories: PlanningCategory[];
  transportMode: 'walk' | 'drive';
  mood?: 'Chill' | 'Adventurous' | 'Romantic' | 'Fun' | 'Surprise me';
  excludedPlaceIds?: string[];
  visitDurations?: Record<string, number>;
}
export interface PlanWarning { code: string; placeId?: string; [key: string]: unknown }
export interface PlannedStop {
  placeId: string; name: string; category: PlanningCategory;
  arrivalAt: string; visitStartAt: string; departureAt: string;
  visitMinutes: number; waitMinutes: number;
}
export interface PlannedTravelLeg {
  fromId: string; toId: string; mode: 'walk' | 'drive';
  durationMinutes: number; departAt: string; arriveAt: string;
}
export interface PlannedItinerary {
  id: string; startAt: string; endAt: string;
  stops: PlannedStop[]; travelLegs: PlannedTravelLeg[];
  estimatedSpendingRange: { minimum: number | null; expected: number | null; maximum: number | null };
  remainingBudget: number | null;
  budgetSummary: {
    assessment: string;
    knownCostSubtotalRange: { minimum: number | null; expected: number | null; maximum: number | null };
    unknownExpenseCategories: string[];
    expectedRemaining: number | null; conservativeRemaining: number | null;
  };
  dataQuality: { openingHours: 'known' | 'unknown'; prices: 'known' | 'unknown' };
  warnings: PlanWarning[];
  planningDurations?: { placeId: string; source: 'rove_planning_assumption' | 'user_supplied_estimate'; minutes: number }[];
}
export interface PlanCreateResponse {
  status: PlanningStatus; demo: boolean;
  plans: PlannedItinerary[]; provisionalPlans: PlannedItinerary[];
  suggestions: { id: string; name: string; category: PlanningCategory; openingStatus: string; priceDataStatus: string;
    source?: { name?: string }; latitude?: number; longitude?: number }[];
  exclusions: { reason: string; placeId?: string | null }[];
  warnings: PlanWarning[];
  providers: { places: string; routes: string };
  attribution: { googleMapsRequired: boolean; googleCopyrightRequired: boolean; thirdParty: unknown[] };
  usage: { placesRequests: number; routesRequests: number; routeElements: number };
  providerFailure?: { stage: 'places' | 'routes'; code: string };
}
