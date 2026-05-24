% Le dice a Prolog que la regla "sampleo" es dinámica.
% Esto evita que el programa crashee si el archivo arranca vacío antes de que Node.js le meta datos.
:- dynamic sampleo/2.

% Intenta cargar (consultar) el archivo "hechos.pl" que genera tu backend.
% El "catch" funciona como un try-catch en Java/JS: si el archivo no existe aún, lo ignora silenciosamente (true) en lugar de lanzar error.
:- catch(consult('hechos.pl'), _, true).

% ==========================================
% EL MOTOR DE RECURSIVIDAD (LA LÓGICA)
% ==========================================

% --- CASO BASE ---
% La condición para que el ciclo se detenga. 
% Se lee: "Un 'Ancestro' es ancestro musical de una 'Cancion' SI existe un hecho directo donde Cancion sampleó a Ancestro".
ancestro_musical(Cancion, Ancestro) :- 
    sampleo(Cancion, Ancestro).

% --- CASO RECURSIVO ---
% Aquí ocurre el bucle infinito controlado para escarbar en el árbol.
% Se lee: "Un 'Ancestro' es ancestro musical de una 'Cancion' SI..."
ancestro_musical(Cancion, Ancestro) :- 
    sampleo(Cancion, Intermedio),           % "...la Cancion sampleó a una pista 'Intermedio'..."
    ancestro_musical(Intermedio, Ancestro). % "...Y recursivamente buscamos quién es el ancestro de esa pista 'Intermedio'."

% ==========================================
% EMPAQUETADO DE LA RESPUESTA PARA NODE.JS
% ==========================================

% Esta es la función principal que Node.js llama desde la terminal.
% Usa la herramienta 'findall' (encontrar todo).
% Se lee: "Busca a todos los 'Ancestros' que cumplan con la regla 'ancestro_musical' para esta 'Cancion', y guárdalos en un arreglo llamado 'ListaAncestros'."
arbol_samples(Cancion, ListaAncestros) :-
    findall(Ancestro, ancestro_musical(Cancion, Ancestro), ListaAncestros).