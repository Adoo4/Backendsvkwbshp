// botrender.js
const axios = require('axios');

const API_KEY = 'pr_live_tBIy_M5QxQr0y1mJr2Zyqmj1BtPDk2f5';
const API_URL = 'https://api.botrender.io';

async function renderSync(url) {
  try {
    const response = await axios.get(`${API_URL}/v1/render/sync`, {
      params: { url },
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data; // rendered HTML
  } catch (error) {
    console.error('BotRender Sync Error:', error.response?.data || error.message);
    throw error;
  }
}

async function renderAsync(url) {
  try {
    const response = await axios.post(
      `${API_URL}/v1/render`,
      { url },
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );
    return response.data.jobId;
  } catch (error) {
    console.error('BotRender Async Error:', error.response?.data || error.message);
    throw error;
  }
}

async function getStatus(jobId) {
  try {
    const response = await axios.get(`${API_URL}/v1/render/${jobId}/status`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data;
  } catch (error) {
    console.error('BotRender Status Error:', error.response?.data || error.message);
    throw error;
  }
}

async function getResult(jobId) {
  try {
    const response = await axios.get(`${API_URL}/v1/render/${jobId}/result`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data;
  } catch (error) {
    console.error('BotRender Result Error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { renderSync, renderAsync, getStatus, getResult };
