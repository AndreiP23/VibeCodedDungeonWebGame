import { PlayerClass } from "@/lib/game/types";

const TEMPLATES: Record<PlayerClass, string[]> = {
  warrior: [
    "Veteran al razboaielor de la miazanoapte, poarta zgarieturile unei batalii pierdute si cauta o cale spre rascumparare in tarmurile uitate.",
    "Crescut intr-un sat de fierari, a invatat sabia inainte de scris. Tatal sau, gardian al primarului, a disparut acum doi ani fara urma.",
    "Fost mercenar al unei companii destramate, isi cara armura ca pe singura mostenire si bea ca sa-si inece visele cu fete fara nume.",
    "Fica de capitan, dezbracata de rangul familiei dupa o tradare a fratelui ei. Cauta sa demonstreze ca onoarea nu e ereditara.",
  ],
  mage: [
    "Fost ucenic la Academia Cenusii, alungat dupa ce a citit un tom interzis. Magia il arde inca de fiecare data cand o foloseste prea mult.",
    "Crescut in padure de o batrana vrajitoare, abia acum coboara la oameni si descopera ca lumea lor are reguli ciudate.",
    "Studiaza disparitiile misterioase din zona de luni intregi. Crede ca firele magice de aici converg spre ceva ascuns sub pamant.",
    "Cartograf arcan in cautarea unui ritual pierdut. A primit o scrisoare anonima despre Coroana Sparta si nu a putut refuza.",
  ],
  rogue: [
    "Crescut in mahalalele orasului-port, a invatat sa supravietuiasca din furtisaguri abile si zambete false. Acum lucreaza pe cont propriu.",
    "Fost spion al breslei, scapat dupa o misiune esuata. Numele sau adevarat e o legenda — nimeni nu-l mai stie, nici macar el.",
    "Vanator de recompense improvizat, a auzit despre fiica primarului si suma promisa pentru orice informatie utila.",
    "Hoata cu cod propriu: nu fura de la disperati. A venit in oras dupa ce a recunoscut un blazon vechi pe poarta tavernei.",
  ],
};

export function buildRandomBackstory(playerClass: PlayerClass): string {
  const pool = TEMPLATES[playerClass];
  return pool[Math.floor(Math.random() * pool.length)];
}
