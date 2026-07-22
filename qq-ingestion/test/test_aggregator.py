import asyncio
import unittest

from lockmyitem_qqbot.aggregator import IncomingMessage, MessageAggregator


class AggregatorTest(unittest.IsolatedAsyncioTestCase):
    async def test_groups_same_sender_and_deduplicates_message_id(self):
        flushed = []

        async def on_flush(batch):
            flushed.append(batch)

        aggregator = MessageAggregator(0.02, on_flush)
        first = IncomingMessage("m1", "g1", "group", "u1", text="地点")
        second = IncomingMessage("m2", "g1", "group", "u1", image_urls=["https://example.invalid/a.jpg"])
        self.assertTrue(await aggregator.add(first))
        self.assertFalse(await aggregator.add(first))
        self.assertTrue(await aggregator.add(second))
        await asyncio.sleep(0.04)
        self.assertEqual([[entry.message_id for entry in batch] for batch in flushed], [["m1", "m2"]])

    async def test_different_senders_are_separate(self):
        flushed = []

        async def on_flush(batch):
            flushed.append(batch)

        aggregator = MessageAggregator(10, on_flush)
        await aggregator.add(IncomingMessage("m1", "g1", "group", "u1"))
        await aggregator.add(IncomingMessage("m2", "g1", "group", "u2"))
        await aggregator.flush_all()
        self.assertEqual(len(flushed), 2)

    async def test_seen_message_cache_is_bounded(self):
        async def on_flush(_batch):
            return None

        aggregator = MessageAggregator(10, on_flush, max_seen_ids=100)
        for index in range(150):
            await aggregator.add(IncomingMessage(f"m{index}", "g1", "group", "u1"))
        self.assertLessEqual(len(aggregator._seen_ids), 100)
        await aggregator.flush_all()


if __name__ == "__main__":
    unittest.main()
