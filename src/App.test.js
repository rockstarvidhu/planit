import React from 'react';
import { act, render, screen } from '@testing-library/react';
import App from './App';
import MapView from './components/MapView';
import ItineraryDisplay from './components/ItineraryDisplay';

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('Planit Frontend Suite', () => {
  afterEach(() => { jest.useRealTimers(); });

  test('renders SplashScreen initially and transitions to UserInputForm', () => {
    jest.useFakeTimers();
    render(<App />);

    expect(screen.getByText('Your AI Travel Planner')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5100);
    });

    expect(screen.getByText('Where to?')).toBeTruthy();
    jest.useRealTimers();
  });

  describe('MapView (BUG-01 Fix)', () => {
    test('renders successfully when passed an array directly', () => {
      const mockPlaces = [
        {
          place_id: 'p1',
          name: 'Cubbon Park',
          address: 'Kasturba Rd, Bengaluru',
          rating: 4.6,
          latitude: 12.9763,
          longitude: 77.5929,
          totalOptionCost: 150,
          travelTime: '15 mins',
          distance: '4.2 km'
        }
      ];

      const { container } = render(<MapView itinerary={mockPlaces} />);

      expect(container.textContent).toContain('Mission Radar');
      expect(container.textContent).toContain('Cubbon Park');
    });

    test('returns null when itinerary is empty array', () => {
      const { container } = render(<MapView itinerary={[]} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('ItineraryDisplay (BUG-03, BUG-04 Fix)', () => {
    test('renders place cards with correct group people count and activities', () => {
      const mockItinerary = [
        {
          place_id: 'p1',
          name: 'Play Arena',
          type: 'entertainment',
          address: 'Sarjapur Rd, Bengaluru',
          rating: 4.4,
          photoUrl: '/api/photo?ref=sample_token',
          costConfidence: 'medium',
          costNote: 'Based on user reviews',
          costPerPerson: 400,
          people: 3,
          activityCost: 1200,
          travelCost: 180,
          totalOptionCost: 1380,
          travelTime: '30 mins (one-way)',
          distance: '12 km',
          activities: ['Go-Karting (~₹400)', 'Bowling (~₹250)'],
          description: 'Popular gaming and activity arena.'
        }
      ];

      const { container } = render(<ItineraryDisplay itinerary={mockItinerary} />);

      expect(container.textContent).toContain('Play Arena');
      expect(container.textContent).toContain('₹400/person × 3');
      expect(container.textContent).toContain('₹1200');
      expect(container.textContent).toContain('₹180');
      expect(container.textContent).toContain('₹1380');
    });
  });
});
