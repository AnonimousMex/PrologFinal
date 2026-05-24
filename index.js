require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { exec } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// URLs divididas para que no se corrompan los enlaces
const URL_TOKEN = "https://" + "accounts.spotify.com" + "/api/token";
const URL_SEARCH = "https://" + "api.spotify.com" + "/v1/search";

// Obtener Token de Spotify
async function getSpotifyToken() {
  const authOptions = {
    method: "post",
    url: URL_TOKEN,
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.SPOTIFY_CLIENT_ID +
            ":" +
            process.env.SPOTIFY_CLIENT_SECRET,
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: "grant_type=client_credentials",
  };
  const response = await axios(authOptions);
  return response.data.access_token;
}

app.get("/api/arbol/:cancion", async (req, res) => {
  // Esto corrige automáticamente si pones stan, STAN o sTaN a "Stan"
  const cancionABuscar = req.params.cancion
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  try {
    const token = await getSpotifyToken();

    // 1. Portada de la rola original
    const spotifyRes = await axios.get(
      `${URL_SEARCH}?q=${encodeURIComponent(cancionABuscar)}&type=track&limit=1`,
      {
        headers: { Authorization: "Bearer " + token },
      },
    );

    const tracks = spotifyRes.data.tracks.items;
    if (tracks.length === 0) {
      return res
        .status(404)
        .json({ error: "La canción no existe en Spotify." });
    }

    const dataSpotify = {
      nombre_oficial: tracks[0].name,
      artista: tracks[0].artists[0].name,
      portada:
        tracks[0].album.images[0]?.url ||
        "https://via.placeholder.com/80/1DB954/FFFFFF?text=Sin+Foto",
    };

    // 2. Supabase y Prolog
    const { data, error: dbError } = await supabase
      .from("vista_samples")
      .select("*");
    if (dbError) throw dbError;

    let contenidoProlog =
      "% Hechos autogenerados desde Supabase\n:- dynamic sampleo/2.\n";
    if (data && data.length > 0) {
      data.forEach((fila) => {
        const nueva = fila.cancion_nueva.replace(/'/g, "''");
        const original = fila.cancion_original.replace(/'/g, "''");
        contenidoProlog += `sampleo('${nueva}', '${original}').\n`;
      });
    }
    fs.writeFileSync("hechos.pl", contenidoProlog);

    const comandoProlog = `swipl -q -f musica.pl -g "arbol_samples('${cancionABuscar}', Resultado), writeln(Resultado), halt."`;

    // 3. Ejecutar Prolog y buscar fotos de los ancestros en Spotify
    exec(comandoProlog, async (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: "Fallo al procesar Prolog" });
      }

      let resultadoLimpio = stdout.trim();
      if (resultadoLimpio === "false" || resultadoLimpio === "[]") {
        return res.json({
          spotify: dataSpotify,
          ancestry_tree: [],
          mensaje: "Sin samples.",
        });
      }

      const listaAncestros = resultadoLimpio
        .replace("[", "")
        .replace("]", "")
        .split(",")
        .map((item) => item.trim());
      const ancestrosConFoto = [];

      for (let cancionAncestro of listaAncestros) {
        try {
          const resAncestro = await axios.get(
            `${URL_SEARCH}?q=${encodeURIComponent(cancionAncestro)}&type=track&limit=1`,
            {
              headers: { Authorization: "Bearer " + token },
            },
          );

          const tracksAncestro = resAncestro.data.tracks.items;
          const foto =
            tracksAncestro.length > 0 &&
            tracksAncestro[0].album.images.length > 0
              ? tracksAncestro[0].album.images[0].url
              : "https://via.placeholder.com/80/282828/FFFFFF?text=Mix";
          const artistaAncestro =
            tracksAncestro.length > 0
              ? tracksAncestro[0].artists[0].name
              : "Desconocido";

          ancestrosConFoto.push({
            titulo: cancionAncestro,
            artista: artistaAncestro,
            portada: foto,
          });
        } catch (e) {
          ancestrosConFoto.push({
            titulo: cancionAncestro,
            artista: "Desconocido",
            portada: "https://via.placeholder.com/80/282828/FFFFFF?text=Mix",
          });
        }
      }

      // 4. Mandar todo empacado al HTML
      res.json({
        spotify: dataSpotify,
        ancestry_tree: ancestrosConFoto,
        mensaje: "Éxito total",
      });
    });
  } catch (err) {
    console.error("Error general:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
