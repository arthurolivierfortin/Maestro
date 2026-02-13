Nous entrons dans une nouvelle phase. Voici mes questions et features :

Nous devons finaliser l'app pour préparer à une première version téléchargeable. Le but est qu'à d'atteindre une première version que nous pouvons télécharger, avoir le setup qu'un utilisateur aurait. Ce que nous devons atteindre :

models:

ajouter une façon de chat avec les models pour les essayer. Il serait intéressant aussi d'ajouter à l'intérieur de maestro un agent comme claude code qui peut utiliser le cli  à notre place.

ajouter les subscriptions et se connecter avec un compte idéalement github. Les but des subscriptions est de faire en sorte que quand le user a un subscription plus haute que la free, ça lui permette d'utiliser plus de feature comme par exemple le catalogue. C'est pour nous permettre de payer les bd qui vont stocker les models publishs des utilisateurs ou qu'ils puissent utiliser les modèles maestro hébergé dans Azure. (il faudrait un provider global mais c'est risqué, à planifier)

L'app doit être téléchargeable, ça télécharge l'app frontend, le cli, le backend. Ça setup aussi le dossier content et autre que l'utilisateur nécessitera.

L'utilisateur pourra donc, une fois le cli téléchargé faire maestro cli pour lancer le cli de n'importe où, par exemple l'utilisateur le lance d'un répo et demande d'attacher le repo sois en workspace ou en session et puisse débuter à utiliser des trucs. Ce sera important de faire en sorte que l'utilisateur puisse avoir des accès lorsque c'est lui qui lance le cli et que si c'est un agent qui fait des requêtes au cli il n'aille pas les permissions (ici ce sera à clarifié selon la philosohphie de maestro)
il y a plein d'autre chose à penser pour cette première version. J'aimerais que vous fassiez une analyse profonde de ce que je viens d'énoncer et que vous analysiez quoi d'autre il manquerait (ex, frontend, sécurité, autre, UI, etc) et que vous me fassiez un document de vos suggestions/prochaines étapes pour les prochaines phases pour ce rendre à cette première version. Mon but est qu'après cette première version je vais moi même télécharger l'App et donner l'accès à un cercle d'utilisateur pour qu'il l'utilise pour voir ce qu'il manque. Ensuite il restera à faire des avancés du côtés de workflows et faire des workflows pour lesquels un nouvel utilisateur pourra utiliser dès le début pour la première version de l'app.

Il es super important de clarifier ce qu'on veut que notre première version soit capable de faire. Dites moi aussi ce que vous pensez de mon plan
