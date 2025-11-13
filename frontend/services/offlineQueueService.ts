// frontend/services/offlineQueueService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'offlineAttendanceQueue';

export interface QueueItem {
  id: string; // A unique ID for the item, e.g., a timestamp
  attendanceToken: string;
}

/**
 * Adds a new attendance record to the offline queue.
 */
export const addToQueue = async (attendanceToken: string): Promise<void> => {
  try {
    const existingQueue = await getQueue();
    const newItem: QueueItem = {
      id: new Date().toISOString(),
      attendanceToken,
    };
    const updatedQueue = [...existingQueue, newItem];
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
    console.log('Item added to offline queue.');
  } catch (e) {
    console.error('Failed to add item to offline queue', e);
  }
};

/**
 * Retrieves the entire offline queue.
 */
export const getQueue = async (): Promise<QueueItem[]> => {
  try {
    const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (e) {
    console.error('Failed to get offline queue', e);
    return [];
  }
};

/**
 * Removes a specific item from the queue (after successful submission).
 */
export const removeFromQueue = async (itemId: string): Promise<void> => {
  try {
    const existingQueue = await getQueue();
    const updatedQueue = existingQueue.filter(item => item.id !== itemId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
    console.log(`Item ${itemId} removed from offline queue.`);
  } catch (e) {
    console.error('Failed to remove item from offline queue', e);
  }
};