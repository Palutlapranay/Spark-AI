import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import Prompt from './models/Prompt.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Generate Endpoint
app.post('/generate', async (req, res) => {
    try {
        const { prompt, width = 1024, height = 1024, size = "1024x1024", engine = "flux" } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        let imageUrl = '';

        // Check if real key is used, otherwise use fallback
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here' || process.env.OPENAI_API_KEY === '') {
            console.log(`Using Pollinations AI fallback (${engine} mode)`);
            const encodedPrompt = encodeURIComponent(prompt);
            const externalUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${engine}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
            imageUrl = externalUrl;
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            try {
                const response = await openai.images.generate({
                    model: "dall-e-3",
                    prompt: prompt,
                    n: 1,
                    size: size,
                });
                const externalUrl = response.data[0].url;
                imageUrl = externalUrl;
            } catch (openAiError) {
                console.warn('OpenAI API Failed (' + openAiError.message + '). Falling back to free Pollinations AI!');
                const encodedPrompt = encodeURIComponent(prompt);
                const externalUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${engine}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
                imageUrl = externalUrl;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Save history
        const newPrompt = new Prompt({ prompt, imageUrl });
        await newPrompt.save();

        res.status(200).json({
            message: 'Image generated successfully',
            imageUrl,
            historyItem: newPrompt
        });

    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ error: 'Failed to generate image', details: error.message });
    }
});

// Get History Endpoint
app.get('/history', async (req, res) => {
    try {
        const history = await Prompt.find().sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Delete specific history item
app.delete('/history/:id', async (req, res) => {
    try {
        await Prompt.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'History item deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete history item' });
    }
});

// Clear all history
app.delete('/history', async (req, res) => {
    try {
        await Prompt.deleteMany({});
        res.status(200).json({ message: 'All history cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// Proxy Image endpoint to bypass browser CORS / ORB blocks
app.get('/proxy-image', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send('URL required');
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });
        
        if (!response.ok) throw new Error(`External API responded with status: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Pass essential headers forward
        res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=31536000');
        
        res.send(buffer);
    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).send('Error proxying image');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
