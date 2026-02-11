Hier nous avons amélioré le TUI. Par contre j'aimerais que le TUI soit un peu comme le frontend, ce que je veux dire est que la page global ne soit  
  pas la page des sessions, j'aimerais que la page global soit pas la page de sessions mais bien la page global. J'aimerais qu'il aie une page models, 
  une page global par laquelle on peut accéder d'autre page. Par contre il faut réfléchir au page. Dans le frontend actuel il a la page foundry et la 
  page projects. Dans les dernier commit nous avions discuté de la page projects pour si on la renommait parce qu'elle contiendrait les sessions et   
  les workspaces, on se demandait si ça valait la peine de les garder séparer ou non. Retrouvez la doc qui parle du choix qu'on avait fait. Nous avons 
  aussi parler dans la PHASE-14 un futur catalogue, en ce moment la page foundry est le catalogue. Est-ce que ça vaudrait la peine de séparer les     
  pages? Car dans le frontend il devra y avoir une page ou l'on peut créer et sois sur la même page ou une autre la page avec le catalogue. Dans       
  foundry on pourrait avoir le catalogue de l'utilisateur (system + user) et avoir une page catalogue ou on peut aller voir ceux que les gens publie.  
  Ces questions sont importante car le TUI devrait représenter les mêmes choses. Le TUI comme mentionné dans la doc de la phase 15, sert de monitor    
  plus simple mais avec les même fonctionnalités pour tester rapidement. Il sert aussi pour les utilisateurs qui préfère ne pas utiliser de souris et  
  qui sont rapide avec le keyboard. Le but est que le tui aille les même fonctionnalités mais accés pour que tout soit facile à faire et efficace avec 
  le keyboard. Et donc ça soulève la question, est-ce que ça va être possible de faire en sorte que la création soit simple par le keyboard et mettre 
  une page de création dans le monitor? Rappelez-vous que le shell cli 
  utilisateur sera là ou l'utilisateur va faire les commandes et que nous allons réutiliser les components du monitor pour faire en sorte d'avoir des  
  visuel rapide dans le shell. Dans ma tête l'utilisateur peut avoir tout les même visuels dans le shell user mais que ce soit plus dans le style      
  claude code et que si il veut vraiment avoir un monitor plus complet, il lance le monitor. Faites une analyse profonde et faites un document dans le dossier de la phase 15 de vos suggestions. 