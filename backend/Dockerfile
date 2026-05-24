# Usamos Node.js como base
FROM node:18

# Actualizamos el sistema e instalamos SWI-Prolog
RUN apt-get update && apt-get install -y swi-prolog

# Definimos el directorio de trabajo
WORKDIR /app

# Copiamos los archivos de configuración y descargamos dependencias
COPY package*.json ./
RUN npm install

# Copiamos todo el resto del código de tu compu al servidor
COPY . .

# El servidor escucha en el puerto 3000
EXPOSE 3000

# Comando para arrancar el servidor
CMD ["node", "index.js"]