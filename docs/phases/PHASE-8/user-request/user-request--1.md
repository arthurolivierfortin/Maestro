Nous entrons dans une nouvelle phase. Cette phase consiste à ce concentrer sur les sessions. Cette      
  phase ne s'occupe pas de l'interface graphique mais seulement que ce soit fonctionnel par cli. Le but   
  de cette phase est de créer une première session fonctionnelle. Cette session sera de type foundry et   
  a pour but de faire un premier environnement d'entrainement/creation. Cette environnement a pour but    
  de créer un tools generate-commit-description. Cette session sera basé sur un repo et lors de la        
  création de cettes session il doit être permit de créer le repo par le cli. Ce choix devrait être       
  donnée dans le cli.
  Pour commencer, rappelons nous que le cli peut être utilisé en faisant maestro commande (avec le        
  fichier index.js pour qu'un puisse le faire ou un humain ou autre, il y a aussi la possibilité de       
  faire des api) mais dans cette étape nous allons débuter à faire le shell maestro pour un utilisateur   
  humain. Ce shell maestro doit être un shell like comme un peut le terminal de claude code qui permet    
  de faire des commande maestro sans toujours faire "maestro ...".

  Le but est que par le cli humain, commande cli avec maestro ... et par api nous puissions démarrer la   
  session. Nous pouvons spécifier si on veut pas de maestro monitor shell, shell qui fait que monitor ce  
  qui se passe dans la session. À l'intérieur de cette session se trouvera un worklow un provider avec    
  son block context qui est lié à un block maestro cli. Son prompt initial sera de lui expliquer qu'il a  
  accès à certaine commande maestro (qui seront filtré selon les tools qu'on lui permet) qu'il peut       
  créer un workflow qui est capable de créer un commit description. le inference block devra avec sa      
  mémoire faire des sorties avec les commandes maestro pour créer son workflow qui pense qu'il   
  respectera les critères de commit description sachant que son workflow va recevoir en entré le 
  résultat d'un script comme qui fait git status --short; git diff --cached; git diff; git log -n 5       
  --oneline. lorsqu'il est satisfait il spécifier dans le json de sa réponse qu'il a finit il devra donc  
  y avoir un block entre lui et de maestro cli et un autre workflow qui va détecter quand il ne voudra    
  plus faire une commande au cli. Lorsqu'il aura terminé, un autre workflow sera démarré qui va utiliser  
  son workflow créé, le tester en lançant un script python qui va lancer le workflow en avec plusieurs  
  exemple différents que pourrait donner git status --short; git diff --cached; git diff; git log -n 5
  --oneline. Ce script va rassembler les résultats et les passer à un provider qui va noter chaque      
  résultats avec un pourcentage avec une description "coaching" de qu'est-ce qui ne fonctionne pas. 

  ensuite lorsque le coaching a finit
  
  un autre workflow s'occuper de documenter la run automatiquement. à la fin de cette run, si le résultats la note moyenne ne dépasse pas le treshhold spécifié dans les valeurs globales de la session (new feature) le résultat de l'évaluation sera retournée au premier workflow qui pourra voir les requêtes que sont workflow a eu, les notes, les commentaires (sois en lui donnant en prompt directement le résultat, sois en ajoutant un tool dans le repo qui lui permet de les voirs, ou autre façon, à vous de voir la meilleure méthode).

  Ceci serait la première phase, lorsque le threshold serait atteint, ça passerait à la deuxième phases ou ce serait le même workflow mais on réinitialiserait le context du inference block et maintenant il aurait la tâche d'améliorer le workflow en diminuant le plus possible de nombre de tokens nécessaire pour son workflow. Ici l'évaluateur devrait pouvoir accéder au workflow et dire si il est possible d'améliorer encore plus le workflow ou pas. Il est important de permettre au inference block createur de pouvoir versionner ses workflow pour pouvoir revenir à l'ancien.

  Lorsque la deuxième phase est terminé et que l'assistant considère qu'il ne peut plus améliorer le workflow, une troisième phase est débutée et cette phase utilise un inference block qui valide le workflow une dernière fois, s'assurer qu'il fonctionne bien. Celui-ci va créer le tools finale qui utilise le workflow créé et le block script qui fait git status --short; git diff --cached; git diff; git log -n 5 --oneline et pour que lorsqu'on n'appelle le tools ça fasse le commit description. Ensuite ce inference block lorsqu'il aura fini il va le spécifier, ensuite un block va stocker dans le repo le tools fini et ensuite un block va automatiquement faire la commande maestro block publish qui va demander de publier le tools dans l'app globale. 

  Par la suite je vais pouvoir faire la commande par le cli maestro block --pending-approval ce qui va me permettre de lister les blocks en attente d'approbation, si je les acceptes il sont publiés, si je ne les accepte pas je peux mettre une description de pourquoi je n'accepte pas. Si je décide de ne pas l'acception ça stock automatiquement dans le repo pourquoi je refuse pour permettre lorsque je vais relancer le workflow qu'il le prenne en compte.

  Sachant que nous voulons diminuer le nombre de token durant la création, vous devez décider quelle est
  le meilleur moyen de setuper ceci. Est-ce qu'on fait un workflow submit-generate-commit-description  
  au lieu de faire un block qui analyse quand le premier block d'inference a fini et qui lancerait      
  automatiquement l'autre workflow. Est-ce que le workflow qui valide devrait au lieu de noter tout en  
  même temps devrait être une boucle qui demande pour chaque résultat quel note il donne et description 
  pour réduire le context nécessaire à l'évaluateur, etc. 

  Les variables de session c'est une feature qui n'est pas seulement pour les sessions foundry mais pour la classe ContainerSession pour pour que les workspaces et tout type de session puisse l'avoir

  Il doit être possible dans ses variables de définir si et lesquels inference blocks sont fait par le llm provider ou pas, pour permettre d'utiliser des agents comme github copilot ou claude code à faire l'évaluation par api ou même la création/entrainement.

dans cette requête, tout les exemples de commande doivent être vérifié. Si les commandes que j'ai énoncé ne fit pas avec les commandes actuelles du cli, vous devez les ajuster. 

Vous devrai ajouter aussi ces fonctionnalités suivant. Dans le shell monitor, je dois pouvoir visualiser ce qui se passe dans la session. Pour le moment ça peut être simple mais je dois quand même pouvoir voir. 

À la fin je devrais pouvoir être capable dans un terminal de faire "maestro" ce qui lance le shell utilisateur. Je dois pouvoir lancer cette session si devant spécifier quelle authorité lance la session. Modifier et voir les variables de la sessions. Lancer les workflows et les visualiser par le monitor shell. Que cette session utilise les de vrai block et que rien ne soit mocké. 

Énormément de chose sont déjà implémenté dans le projet. Vous devez donc faire une analyse profonde du projet actuel et de ce qui exite déjà. 

Pour les visualisations du monitor fiez vous sur le document DESIGN-CONTROL-FLOW-BLOCKS.md. Tout les fichiers DESIGN-** qui sont dans ce dossier peuvent aussi être utile pour votre compréhension ainsi que le document sur la philosophie maestro. 

Vous devrez lors de votre analyse faire un document qui permet à n'importe quel agent de lire votre document et de comprendre ce qui vous a apporté à faire vos choix sans devoir retourner dans le projet. 

Vous devrez faire un document complet de vos suggestions. Ce document doit montrer les visualisations de ce que vous aller créer comme les visualisations de la session, de son intérieur, de son fonctionnement. Vous devrez aussi faire le pipeline complet en expliquant chaque commande que l'utilisateur doit faire pour utiliser cette session, montrer à quoi ça va ressembler. Vous devrez aussi expliquer tout vos choix de conceptions qui n'était pas clarifié dans ma demande.

Vos documents devront être dans le dossier PHASE-8 dans un nouveau dossier qui permet de structurer vos documents.
