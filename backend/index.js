const { WebSocket } = require("ws");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { exec } = require("child_process");

const app = express();
// CORS abierto para que tu página web de Vercel pueda hablar con este servidor
app.use(cors({ origin: "*" }));
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    realtime: { transport: WebSocket },
  },
);

const URL_SEARCH = "https://api.spotify.com/v1/search";
const URL_TOKEN = "https://accounts.spotify.com/api/token";

async function getSpotifyToken() {
  const auth = Buffer.from(
    process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET,
  ).toString("base64");
  const response = await axios.post(
    URL_TOKEN,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  return response.data.access_token;
}

app.get("/api/arbol/:cancion", async (req, res) => {
  const cancionABuscar = req.params.cancion
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  try {
    const token = await getSpotifyToken();
    const spotifyRes = await axios.get(
      `${URL_SEARCH}?q=${encodeURIComponent(cancionABuscar)}&type=track&limit=1`,
      { headers: { Authorization: "Bearer " + token } },
    );

    const tracks = spotifyRes.data.tracks.items;
    if (tracks.length === 0)
      return res.status(404).json({ error: "No encontrada" });

    const dataSpotify = {
      nombre_oficial: tracks[0].name,
      artista: tracks[0].artists[0].name,
      portada: tracks[0].album.images[0]?.url,
    };

    const { data } = await supabase.from("vista_samples").select("*");
    let contenidoProlog = ":- dynamic sampleo/2.\n";
    if (data)
      data.forEach(
        (f) =>
          (contenidoProlog += `sampleo('${f.cancion_nueva.replace(/'/g, "''")}', '${f.cancion_original.replace(/'/g, "''")}').\n`),
      );
    fs.writeFileSync("hechos.pl", contenidoProlog);

    exec(
      `swipl -q -f musica.pl -g "arbol_samples('${cancionABuscar}', R), writeln(R), halt."`,
      async (err, stdout) => {
        if (err) return res.status(500).json({ error: "Error en Prolog" });
        const lista = stdout
          .trim()
          .replace(/[\[\]]/g, "")
          .split(",")
          .map((i) => i.trim())
          .filter((i) => i !== "");
        const ancestros = [];
        for (let nombre of lista) {
          const resA = await axios.get(
            `${URL_SEARCH}?q=${encodeURIComponent(nombre)}&type=track&limit=1`,
            { headers: { Authorization: "Bearer " + token } },
          );
          ancestros.push({
            titulo: nombre,
            artista: resA.data.tracks.items[0]?.artists[0].name || "N/A",
            portada: resA.data.tracks.items[0]?.album.images[0]?.url || "",
          });
        }
        res.json({ spotify: dataSpotify, ancestry_tree: ancestros });
      },
    );
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor arriba"));
