import { randomUUID } from 'node:crypto'
import { Kafka } from 'kafkajs'

export const CHAT_TOPIC = 'chat-messages'

const kafka = new Kafka({
  clientId: 'chat-app',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
})

const producer = kafka.producer()
let producerConnected = false
let topicReady

// broker has topic auto-creation disabled, so the topic must exist before producing/consuming
function ensureTopicExists() {
  if (!topicReady) {
    topicReady = (async () => {
      const admin = kafka.admin()
      await admin.connect()
      try {
        const topics = await admin.listTopics()
        if (!topics.includes(CHAT_TOPIC)) {
          await admin.createTopics({ topics: [{ topic: CHAT_TOPIC, numPartitions: 1 }] })
        }
      } finally {
        await admin.disconnect()
      }
    })().catch((err) => {
      // don't cache a failed attempt (e.g. broker not ready yet) - allow the next call to retry
      topicReady = undefined
      throw err
    })
  }
  return topicReady
}

export async function connectProducer() {
  await ensureTopicExists()
  if (!producerConnected) {
    await producer.connect()
    producerConnected = true
  }
}

export async function disconnectProducer() {
  if (producerConnected) {
    await producer.disconnect()
    producerConnected = false
  }
}

export async function sendChatMessage(message) {
  await connectProducer()
  await producer.send({
    topic: CHAT_TOPIC,
    messages: [{ value: JSON.stringify(message) }],
  })
}

// resolves once subscribed; onMessage fires for every message read from the topic
export async function startChatConsumer(onMessage) {
  await ensureTopicExists()
  // unique group id per boot so fromBeginning always replays full persisted history into the in-memory cache
  const consumer = kafka.consumer({ groupId: `chat-group-${randomUUID()}` })
  await consumer.connect()
  await consumer.subscribe({ topic: CHAT_TOPIC, fromBeginning: true })
  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        onMessage(JSON.parse(message.value.toString()))
      } catch (err) {
        console.error('Failed to parse chat message', err)
      }
    },
  })
  return consumer
}