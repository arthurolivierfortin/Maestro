J'ai un problème actuellement. J'ai l'impression que nous n'avançons pas les phases comme on le devrait. J'ai fait beaucoup de séance de dogfooding    
  récemment mais c'était toujours superficiel malgré les instructions. J'ai aussi avec les agents tendances à refactor souvent car ce n'est pas à mon     
  gout. En ce moment le maestro code est correct mais j'hésite fortement entre faire en sorte qu'il soit plus axé sur les commandes terminal. Par         
  exemple, que je fasse cd sessions pour aller dans le panel sessions. Ça éviterait de devoir gérer des navigations complexes et permettrait que les      
  même commandes puisse se faire dans le cli aussi. Le problème est que ça nécessite de repenser l'interface (encore une refonte) car mon idéal aurait    
  été un interface qu'on arrive à l'Agent directement mais ça vient créer plein de paradoxe. Exemple, si tout est commande cli, est-ce qu'il va devoir    
  faire maestro block run code ou je sais pas ce qui je trouve n'est pas une bonne idée. J'ai aussi un block mentale en ce moment. Je trouve ça très      
  difficile de ne pas être abusif sur "tout est un block" et que tout soit modulaire. Quand j'avais pensé à l'app, mon but était que tout soit basé sur   
  des commandes simples et que les apps puisse utiliser maestro de la même façon qu'un utilisateur le ferait et en ce moment pour maestro code il serait  
  plus facile de faire du code non basé sur des blocks et tout en code directement comme par exemple l'agent principale dans l'app. Par contre le but     
  est que l'app puisse se construire elle même plus tard alors de faire en sorte que ce soit des blocks pour par exemple l'agent fait en sorte qu'on      
  puisse l'optimiser comme on le ferait normalement ce que je préfère. Mon but est de faire en sorte que maestro code soit un peu elle même une app basé  
  sur maestro (paradoxe l'oeuf et la poule). On avait fait la séparation avec le dossier system pour "permettre" ceci mais j'ai encore un bug mentale     
  et c'est difficile de savoir clairement ou on s'en va sans régresser. L'autre chose que je trouve c'est que normalement ce serait facile de faire un    
  classe conversation et de lui ajouter des fonctions comme add-message ou autre mais avec les blocks, si on veut que ce soit transparant ça fait         
  énormément de blocks. Mon but est de garder cette architecture là mais j'ai vraiment besoin de vous pour clarifier le tout. J'ai besoin d'une analyse   
  ultra profonde qui vient solidifier la suite, qui était supposé être la première version déployable. Il y a énormément de chose ;a prendre en compte    
  dans cette analyse comme notre roadmap, les buts de l'app, etc. Il y a des valeurs et but de l'app qui sont très important qui semble être oublié       
  parfois. J'ai aussi besoin de vous pour me guider sur les erreurs que je fait.  