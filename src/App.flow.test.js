import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

const originalFetch = global.fetch;
beforeEach(() => { jest.useFakeTimers(); global.fetch = jest.fn(); });
afterEach(() => { jest.useRealTimers(); global.fetch = originalFetch; });

function submitPlan() {
  render(<App />);
  act(() => { jest.advanceTimersByTime(5100); });
  fireEvent.change(screen.getByPlaceholderText('City or Address'), { target: { value: 'Bengaluru' } });
  fireEvent.click(screen.getByRole('button', { name: 'NEXT >' }));
  fireEvent.change(screen.getByPlaceholderText('2000'), { target: { value: '5000' } });
  fireEvent.click(screen.getByRole('button', { name: 'NEXT >' }));
  fireEvent.click(screen.getByRole('button', { name: 'FIND PLANS' }));
}

test('provider failure restores the form and displays a safe error', async () => {
  global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'External provider timed out', code: 'PROVIDER_TIMEOUT' }) });
  submitPlan();
  expect(await screen.findByText('External provider timed out')).toBeTruthy();
  expect(screen.getByPlaceholderText('City or Address')).toBeTruthy();
});

test('cancel aborts the actual fetch and restores the form without an error banner', async () => {
  let signal;
  global.fetch.mockImplementation((url, options) => new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(Object.assign(new Error('Canceled'), { name: 'AbortError' })));
  }));
  submitPlan();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Generation' }));
  expect(signal.aborted).toBe(true);
  expect(await screen.findByPlaceholderText('City or Address')).toBeTruthy();
  expect(screen.queryByText('Something went wrong')).toBeNull();
});
