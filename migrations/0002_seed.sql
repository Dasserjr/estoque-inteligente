-- Seed inicial: catálogo migrado da planilha atual + estoque inicial como eventos de 'ajuste'.
-- par_level = nível ideal a manter; min_nivel = ponto de reposição (entra na lista de compras).

INSERT INTO catalogo (id, nome_canonico, categoria, unidade, tamanho, par_level, min_nivel, icone) VALUES
 (1 ,'Água sanitária'                ,'Desinfecção'   ,'L'   ,'5L'   ,2 ,1 ,'🧴'),
 (2 ,'Ajax'                          ,'Limpeza geral' ,'L'   ,'1L'   ,2 ,1 ,'🧴'),
 (3 ,'Amaciante'                     ,'Roupa'         ,'L'   ,'2L'   ,2 ,1 ,'🧺'),
 (4 ,'Bom Ar'                        ,'Aromatizador'  ,'un'  ,'360ml',1 ,1 ,'💨'),
 (5 ,'Buchinha'                      ,'Acessórios'    ,'un'  ,''     ,6 ,2 ,'🧽'),
 (6 ,'Detergente'                    ,'Louça'         ,'un'  ,'500ml',12,3 ,'🧴'),
 (7 ,'Lysoform'                      ,'Desinfecção'   ,'L'   ,'5L'   ,1 ,1 ,'🧴'),
 (8 ,'Óleo de peroba'                ,'Madeira'       ,'un'  ,''     ,2 ,1 ,'🪵'),
 (9 ,'Palha de aço inox (pia)'       ,'Acessórios'    ,'un'  ,''     ,3 ,1 ,'🧽'),
 (10,'Palha de aço inox (tanque)'    ,'Acessórios'    ,'un'  ,'grande',2,1 ,'🧽'),
 (11,'Rodinho de pia'                ,'Acessórios'    ,'un'  ,''     ,2 ,1 ,'🧹'),
 (12,'Saquinhos G (lixo saída)'      ,'Descartáveis'  ,'rolo',''     ,1 ,1 ,'🗑️'),
 (13,'Saquinhos M (banheiro)'        ,'Descartáveis'  ,'rolo',''     ,1 ,1 ,'🗑️'),
 (14,'Sabão em barra'                ,'Roupa'         ,'un'  ,''     ,5 ,1 ,'🧼'),
 (15,'Sabão de côco'                 ,'Roupa'         ,'un'  ,''     ,5 ,1 ,'🧼'),
 (16,'Sabão em pó'                   ,'Roupa'         ,'un'  ,'caixa',2 ,1 ,'🧺'),
 (17,'Sabão líquido'                 ,'Roupa'         ,'L'   ,''     ,2 ,1 ,'🧺'),
 (18,'Sapóleo'                       ,'Limpeza pesada','un'  ,'450ml',2 ,1 ,'🧴'),
 (19,'Veja / Ypê multiuso'           ,'Limpeza geral' ,'un'  ,'500ml',2 ,1 ,'🧴'),
 (20,'Veja limpa chão'               ,'Chão'          ,'L'   ,'2L'   ,2 ,1 ,'🧹'),
 (21,'Vidrex'                        ,'Vidros'        ,'un'  ,'500ml',2 ,1 ,'🪟');

-- Estoque inicial (vira evento de ajuste, mantendo a filosofia do ledger)
INSERT INTO eventos (catalogo_id, tipo, qtd, quem) VALUES
 (1 ,'ajuste',2 ,'sistema'),(2 ,'ajuste',2 ,'sistema'),(3 ,'ajuste',2 ,'sistema'),
 (4 ,'ajuste',1 ,'sistema'),(5 ,'ajuste',6 ,'sistema'),(6 ,'ajuste',12,'sistema'),
 (7 ,'ajuste',1 ,'sistema'),(8 ,'ajuste',2 ,'sistema'),(9 ,'ajuste',3 ,'sistema'),
 (10,'ajuste',2 ,'sistema'),(11,'ajuste',2 ,'sistema'),(12,'ajuste',1 ,'sistema'),
 (13,'ajuste',1 ,'sistema'),(14,'ajuste',5 ,'sistema'),(15,'ajuste',5 ,'sistema'),
 (16,'ajuste',2 ,'sistema'),(17,'ajuste',2 ,'sistema'),(18,'ajuste',2 ,'sistema'),
 (19,'ajuste',2 ,'sistema'),(20,'ajuste',2 ,'sistema'),(21,'ajuste',2 ,'sistema');
